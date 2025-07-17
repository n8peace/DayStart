import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
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
        function: 'generate-encouragement-content',
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
          function: 'generate-encouragement-content',
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
  ])

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const utcDateStr = utcDate()
    const expirationDate = new Date(utcDateStr)
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Generate encouragement content using GPT-4
    let encouragementContent = null
    let gptError = null
    try {
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
      if (openaiApiKey) {
        const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are a motivational coach who creates brief, uplifting morning messages. Keep responses under 10words and focus on positivity, personal growth, and starting the day with energy.'
              },
              {
                role: 'user',
                content: 'Create a brief, encouraging morning message for someone starting their day. Make it personal, motivational, and actionable.'
              }
            ],
            max_tokens: 150,
            temperature: 0.8
          }),
          signal: AbortSignal.timeout(15 * 1000) // 15 second timeout
        })

        if (gptResponse.ok) {
          const gptData = await gptResponse.json()
          if (gptData.choices && gptData.choices[0]?.message?.content) {
            encouragementContent = gptData.choices[0].message.content.trim()
          } else {
            gptError = 'Invalid GPT response format'
          }
        } else {
          gptError = `OpenAI API failed: ${gptResponse.status}`
        }
      } else {
        gptError = 'OpenAI API key not configured'
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        gptError = 'OpenAI API request timed out'
      } else {
        gptError = `OpenAI API error: ${error.message}`
      }
    }

    // Log API call
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'api_call',
          status: gptError ? 'error' : 'success',
          message: gptError || 'Encouragement content generated successfully',
          metadata: { api: 'openai_gpt4' }
        })
    } catch (logError) {
      safeLogError('Failed to log API call:', logError)
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'encouragement',
      date: utcDateStr,
      content: encouragementContent || 'Have a wonderful day filled with positivity and growth!',
      parameters: {
        gpt_generated: !!encouragementContent,
        gpt_error: gptError,
        fallback_used: !encouragementContent
      },
      status: gptError ? ContentBlockStatus.CONTENT_FAILED : ContentBlockStatus.CONTENT_READY,
      content_priority: 6,
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

    // Log successful content generation
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generated',
          status: 'success',
          message: 'Encouragement content generated successfully',
          content_block_id: data.id,
          metadata: { content_type: 'encouragement', date: utcDateStr }
        })
    } catch (logError) {
      safeLogError('Failed to log successful generation:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_block: data,
        gpt_error: gptError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error generating encouragement content:', error)

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
          message: `Encouragement content generation failed: ${error.message}`,
          metadata: { content_type: 'encouragement', error: error.toString() }
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