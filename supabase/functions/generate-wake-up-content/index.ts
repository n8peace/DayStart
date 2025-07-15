import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContentBlock {
  id: string
  content_type: string
  date: string
  content?: string
  parameters?: any
  status: string
  content_priority: number
  expiration_date: string
  language_code: string
  created_at: string
  updated_at: string
}

interface LogEntry {
  event_type: string
  status: string
  message: string
  metadata?: any
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get UTC dates for content generation
    const utcDate = new Date().toISOString().split('T')[0]
    const tomorrowUtc = new Date()
    tomorrowUtc.setDate(tomorrowUtc.getDate() + 1)
    const tomorrowDate = tomorrowUtc.toISOString().split('T')[0]
    
    // Get day of the week for tomorrow
    const dayOfWeek = tomorrowUtc.toLocaleDateString('en-US', { weekday: 'long' })

    // Get expiration date (72 hours from now) in UTC
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Get yesterday's wake-up message to avoid repetition
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = yesterday.toISOString().split('T')[0]

    let previousMessage = ''
    try {
      const { data: previousData, error: previousError } = await supabaseClient
        .from('content_blocks')
        .select('content')
        .eq('content_type', 'wake_up')
        .eq('date', yesterdayDate)
        .in('status', ['ready', 'content_ready'])
        .not('status', 'content_failed')
        .limit(1)
        .single()

      if (previousData) {
        previousMessage = previousData.content || ''
      }
    } catch (error) {
      console.log('No previous wake-up message found or error:', error)
    }

    // Fetch holiday data from Abstracts API
    let holidayData = null
    let holidayError = null
    try {
      const abstractsApiKey = Deno.env.get('ABSTRACTS_API_KEY')
      if (abstractsApiKey) {
        const holidayResponse = await fetch(`https://holidays.abstractapi.com/v1/?api_key=${abstractsApiKey}&country=US&year=${new Date().getFullYear()}&date=${utcDate}`)
        if (holidayResponse.ok) {
          holidayData = await holidayResponse.json()
        } else {
          holidayError = `Holiday API failed: ${holidayResponse.status}`
        }
      } else {
        holidayError = 'Abstracts API key not configured'
      }
    } catch (error) {
      holidayError = `Holiday API error: ${error.message}`
    }

    // Log API call
    await supabaseClient
      .from('logs')
      .insert({
        event_type: 'api_call',
        status: holidayError ? 'error' : 'success',
        message: holidayError || 'Holiday data fetched successfully',
        metadata: { api: 'abstracts_holiday', date: utcDate }
      })

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'wake_up',
      date: tomorrowDate,
      content: `Date: ${tomorrowDate} (${dayOfWeek}). Previous message: ${previousMessage}. Holiday: ${holidayData ? JSON.stringify(holidayData) : 'No holiday data available'}`,
      parameters: {
        previous_message: previousMessage,
        holiday_data: holidayData,
        holiday_error: holidayError
      },
      status: 'content_ready', // Content ready after successful generation
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

    // Log successful content generation
    await supabaseClient
      .from('logs')
      .insert({
        event_type: 'content_generated',
        status: 'success',
        message: 'Wake-up content generated successfully',
        metadata: { content_block_id: data.id, content_type: 'wake_up', date: tomorrowDate }
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

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabaseClient
        .from('logs')
        .insert({
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