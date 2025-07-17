import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'
import { runHealthChecks, HealthReport } from './health-checks.ts'
import { sendHealthReportEmail } from './email-service.ts'

serve(async (req) => {
  console.log('🔍 health-check function called')
  console.log('🔍 Request method:', req.method)
  console.log('🔍 Request URL:', req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔍 Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate required environment variables
  validateEnvVars([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    // Run health checks
    const healthResults = await runHealthChecks(supabaseClient)

    // Log health check results
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'health_check_completed',
          status: healthResults.overall_status === 'healthy' ? 'success' :
                  healthResults.overall_status === 'warning' ? 'warning' : 'error',
          message: `Health check completed: ${healthResults.overall_status}`,
          metadata: {
            overall_status: healthResults.overall_status,
            passed_checks: healthResults.summary.healthy_count,
            failed_checks: healthResults.summary.critical_count + healthResults.summary.warning_count,
            total_checks: healthResults.summary.total_checks,
            check_details: healthResults.checks
          }
        })
    } catch (logError) {
      safeLogError('Failed to log health check results:', logError)
    }

    // Send email report if there are failures
    if (healthResults.summary.critical_count + healthResults.summary.warning_count > 0) {
      try {
        await sendHealthReportEmail(healthResults, Deno.env.get('RESEND_API_KEY') ?? '')
      } catch (emailError) {
        console.error('Failed to send health report email:', emailError)
        // Log email failure
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'health_report_email_failed',
              status: 'error',
              message: `Failed to send health report email: ${emailError.message}`,
              metadata: { error: emailError.toString() }
            })
        } catch (logError) {
          safeLogError('Failed to log email error:', logError)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: healthResults.overall_status === 'healthy',    overall_status: healthResults.overall_status,
        passed_checks: healthResults.summary.healthy_count,
        failed_checks: healthResults.summary.critical_count + healthResults.summary.warning_count,
        total_checks: healthResults.summary.total_checks,
        checks: healthResults.checks,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: healthResults.overall_status === 'healthy' ? 200 : 503
      }
    )

  } catch (error) {
    console.error('Error running health checks:', error)

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'health_check_failed',
          status: 'error',
          message: `Health check failed: ${error.message}`,
          metadata: { error: error.toString() }
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

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