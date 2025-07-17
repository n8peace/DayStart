import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock, LogEntry } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

serve(async (req) => {
  // Deployment trigger - Wed Jul 17 06:13:24 PDT 2025
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests
  const url = new URL(req.url)
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    try {
      const response = {
        status: 'healthy',
        function: 'generate-wake-up-content',
        timestamp: new Date().toISOString()
      }
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (healthError) {
      return new Response(
        JSON.stringify({
          status: 'error',
          function: 'generate-wake-up-content',
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

  // Validate required environment variables
  validateEnvVars([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    // Calendarific is optional, but warn if missing
  ])

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const tomorrowDate = utcDate(1)
    const dayOfWeek = new Date(tomorrowDate).toLocaleDateString('en-US', { weekday: 'long' })
    const expirationDate = new Date(tomorrowDate)
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]
    const yesterdayDate = utcDate(-1)

    let previousMessage = ''
    try {
      const { data: previousData } = await supabaseClient
        .from('content_blocks')
        .select('content')
        .eq('content_type', 'wake_up')
        .eq('date', yesterdayDate)
        .in('status', [ContentBlockStatus.READY, ContentBlockStatus.CONTENT_READY])
        .not('status', ContentBlockStatus.CONTENT_FAILED)
        .limit(1)
        .single()
      if (previousData) {
        validateObjectShape(previousData, ['content'])
        previousMessage = previousData.content || ''
      }
    } catch (error) {
      // No previous message found, ignore
    }

    // Fetch holiday data from Calendarific API
    let holidayData: any = null
    let holidayError: string | null = null
    try {
      const calendarificApiKey = Deno.env.get('CALENDARIFIC_API_KEY')
      if (calendarificApiKey) {
        const [year, month, day] = tomorrowDate.split('-')
        const holidayResponse = await fetch(`https://calendarific.com/api/v2/holidays?api_key=${calendarificApiKey}&country=US&year=${year}&month=${parseInt(month)}&day=${parseInt(day)}`)
        if (holidayResponse.ok) {
          const responseData = await holidayResponse.json()
          if (responseData && responseData.response && Array.isArray(responseData.response.holidays)) {
            holidayData = responseData.response.holidays
          } else {
            holidayError = 'Malformed Calendarific response'
          }
        } else {
          holidayError = `Calendarific API failed: ${holidayResponse.status}`
        }
      } else {
        holidayError = 'Calendarific API key not configured'
      }
    } catch (error) {
      holidayError = `Calendarific API error: ${error.message}`
    }

    await safeLogError(supabaseClient, {
      event_type: 'api_call',
      status: holidayError ? 'error' : 'success',
      message: holidayError || 'Calendarific holiday data fetched successfully',
      metadata: { api: 'calendarific_holiday', date: tomorrowDate }
    })

    const contentBlock: Partial<ContentBlock> = {
      content_type: 'wake_up',
      date: tomorrowDate,
      content: `Date: ${tomorrowDate} (${dayOfWeek}). Previous message: ${previousMessage}. Holiday: ${holidayData ? JSON.stringify(holidayData) : 'No holiday data available'}`,
      parameters: {
        previous_message: previousMessage,
        holiday_data: holidayData,
        holiday_error: holidayError
      },
      status: ContentBlockStatus.CONTENT_READY,
      content_priority: 1,
      expiration_date: expirationDateStr,
      language_code: 'en-US'
    }

    const { data, error } = await supabaseClient
      .from('content_blocks')
      .insert(contentBlock)
      .select()
      .single()

    if (error) {
      throw error
    }
    validateObjectShape(data, ['id', 'content_type', 'date', 'status'])

    await safeLogError(supabaseClient, {
      event_type: 'content_generated',
      status: 'success',
      message: 'Wake-up content generated successfully',
      content_block_id: data.id,
      metadata: { content_type: 'wake_up', date: tomorrowDate }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        holiday_error: holidayError 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating wake-up content:', error)
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await safeLogError(supabaseClient, {
        event_type: 'content_generation_failed',
        status: 'error',
        message: `Wake-up content generation failed: ${error.message}`,
        metadata: { content_type: 'wake_up', error: error.toString() }
      })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 