import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runHealthChecks, HealthReport } from './health-checks.ts'
import { sendHealthReportEmail } from './email-service.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🔍 health-check function called')
  console.log('🔍 Request method:', req.method)
  console.log('🔍 Request URL:', req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔍 Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests for the function itself
  const url = new URL(req.url)
  console.log('🔍 URL pathname:', url.pathname)
  
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    console.log('🔍 Handling health check request')
    try {
      const response = {
        status: 'healthy',
        function: 'health-check',
        timestamp: new Date().toISOString()
      }
      console.log('🔍 Health check response:', response)
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (healthError) {
      console.error('🔍 Health check error:', healthError)
      return new Response(
        JSON.stringify({
          status: 'error',
          function: 'health-check',
          error: healthError.message,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }
  }

  // Validate HTTP method for non-health check requests
  if (req.method !== 'POST') {
    console.log('🔍 Invalid method:', req.method)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Method ${req.method} not allowed. Use POST.` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  try {
    console.log('🔍 Starting health check process')
    
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables')
    }

    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured - email notifications will be skipped')
    }

    // Create Supabase client
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    console.log('🔍 Supabase client created successfully')

    // Run all health checks
    console.log('🔍 Running health checks...')
    const healthReport = await runHealthChecks(supabaseClient)
    console.log('🔍 Health checks completed')

    // Send email report if Resend is configured
    let emailSent = false
    let emailError = null
    
    if (resendApiKey) {
      try {
        console.log('🔍 Sending email report...')
        await sendHealthReportEmail(healthReport, resendApiKey)
        emailSent = true
        console.log('🔍 Email report sent successfully')
      } catch (emailErr) {
        console.error('🔍 Email sending failed:', emailErr)
        emailError = emailErr.message
      }
    }

    // Log the health check completion
    await safeLogError(supabaseClient, {
      event_type: 'health_check_completed',
      status: healthReport.overall_status === 'healthy' ? 'success' : 
              healthReport.overall_status === 'warning' ? 'warning' : 'error',
      message: `Health check completed: ${healthReport.overall_status}`,
      metadata: {
        total_checks: healthReport.summary.total_checks,
        healthy_count: healthReport.summary.healthy_count,
        warning_count: healthReport.summary.warning_count,
        critical_count: healthReport.summary.critical_count,
        email_sent: emailSent,
        email_error: emailError
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        health_report: healthReport,
        email_sent: emailSent,
        email_error: emailError,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('🔍 Health check function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// Helper function to safely log errors
async function safeLogError(supabaseClient: any, logData: any) {
  try {
    await supabaseClient
      .from('logs')
      .insert({
        event_type: logData.event_type,
        status: logData.status,
        message: logData.message,
        metadata: logData.metadata || {}
      })
  } catch (logError) {
    console.error('Failed to log to database:', logError)
  }
} 