import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

// Encouragement types with philosophical approaches
const ENCOURAGEMENT_TYPES = [
  { type: 'christian', philosophy: 'Christian faith-based encouragement with biblical wisdom and spiritual guidance' },
  { type: 'stoic', philosophy: 'Stoic philosophy focusing on virtue, resilience, and controlling what we can' },
  { type: 'muslim', philosophy: 'Islamic faith-based encouragement with Quranic wisdom and spiritual guidance' },
  { type: 'jewish', philosophy: 'Jewish faith-based encouragement with Torah wisdom and spiritual guidance' },
  { type: 'general', philosophy: 'General motivational encouragement focusing on personal growth and positivity' }
]

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

  // Declare variables outside try block so they're accessible in catch block
  let executionStatus = 'completed'
  let apiCallCount = 0
  let successfulGenerations = 0
  let failedGenerations = 0
  const generatedContentBlocks = []

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const utcDateStr = utcDate()
    const expirationDate = new Date(utcDateStr)
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Generate encouragement content for each type
    for (const encouragementType of ENCOURAGEMENT_TYPES) {
      try {
        // Get previous 5 scripts for this encouragement type to avoid repetition
        const { data: previousScripts } = await supabaseClient
          .from('content_blocks')
          .select('script')
          .eq('content_type', 'encouragement')
          .eq('parameters->encouragementType', encouragementType.type)
          .eq('status', 'ready')
          .not('script', 'is', null)
          .order('created_at', { ascending: false })
          .limit(5)

        const previousMessages = previousScripts?.map(block => block.script).filter(Boolean) || []

        // Generate content using GPT-4
        let encouragementContent: string | null = null
        let gptError: string | null = null
        try {
          const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
          if (openaiApiKey) {
            apiCallCount++
            console.log(`Making OpenAI GPT-4 API call for ${encouragementType.type} encouragement content`)
            
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
                    content: `You are a motivational coach who creates brief, uplifting morning messages. Focus on ${encouragementType.philosophy}. Keep responses under 10 words and focus on positivity, personal growth, and starting the day with energy.`
                  },
                  {
                    role: 'user',
                    content: `Create a brief, encouraging morning message for someone starting their day. Make it personal, motivational, and actionable. Focus on ${encouragementType.philosophy}. Avoid repeating these previous messages: ${previousMessages.join(', ')}`
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
                console.log(`Successfully generated ${encouragementType.type} encouragement content via GPT-4`)
              } else {
                gptError = 'Invalid GPT response format'
                console.error('Invalid GPT response format:', gptData)
              }
            } else {
              gptError = `OpenAI API failed: ${gptResponse.status}`
              console.error('OpenAI API failed:', gptResponse.status)
            }
          } else {
            gptError = 'OpenAI API key not configured'
            console.warn('OpenAI API key not configured')
          }
        } catch (error) {
          if (error.name === 'TimeoutError') {
            gptError = 'OpenAI API request timed out'
            console.error('OpenAI API timeout error:', error)
          } else {
            gptError = `OpenAI API error: ${error.message}`
            console.error('OpenAI API error:', error)
          }
        }

        // Create fallback content if GPT fails
        const finalContent = encouragementContent || `Have a wonderful day filled with positivity and growth!`

        // Determine content block status
        let finalStatus = ContentBlockStatus.CONTENT_READY
        if (gptError && !encouragementContent) {
          // Still mark as ready since we have fallback content
          finalStatus = ContentBlockStatus.CONTENT_READY
        }

        // Create content block for this encouragement type
        const contentBlock: Partial<ContentBlock> = {
          content_type: 'encouragement',
          date: utcDateStr,
          content: finalContent,
          parameters: {
            encouragementType: encouragementType.type,
            philosophy: encouragementType.philosophy,
            gpt_generated: !!encouragementContent,
            gpt_error: gptError,
            fallback_used: !encouragementContent,
            previous_messages_count: previousMessages.length,
            execution_status: gptError ? 'completed_with_warnings' : 'completed',
            api_call_count: 1
          },
          status: finalStatus,
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

        generatedContentBlocks.push(data)
        successfulGenerations++

        // Log successful content generation for this type
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'content_generated',
              status: 'success',
              message: `${encouragementType.type} encouragement content generated successfully`,
              content_block_id: data.id,
              metadata: { 
                content_type: 'encouragement', 
                encouragement_type: encouragementType.type,
                date: utcDateStr,
                execution_status: gptError ? 'completed_with_warnings' : 'completed'
              }
            })
        } catch (logError) {
          console.error('Failed to log successful generation:', logError)
        }

      } catch (typeError) {
        failedGenerations++
        console.error(`Error generating ${encouragementType.type} encouragement content:`, typeError)
        
        // Log error for this type
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'content_generation_failed',
              status: 'error',
              message: `${encouragementType.type} encouragement content generation failed: ${typeError.message}`,
              metadata: { 
                content_type: 'encouragement', 
                encouragement_type: encouragementType.type,
                error: typeError.toString(),
                errorType: typeError.name,
                stack: typeError.stack
              }
            })
        } catch (logError) {
          console.error('Failed to log error:', logError)
        }
      }
    }

    // Determine overall execution status
    if (failedGenerations > 0) {
      executionStatus = failedGenerations === ENCOURAGEMENT_TYPES.length ? 'failed' : 'completed_with_warnings'
    }

    // Log overall API call summary
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'api_call',
          status: executionStatus === 'failed' ? 'error' : 'success',
          message: `Encouragement content generation completed: ${successfulGenerations} successful, ${failedGenerations} failed`,
          metadata: { 
            api: 'openai_gpt4',
            execution_status: executionStatus,
            successful_generations: successfulGenerations,
            failed_generations: failedGenerations,
            total_api_calls: apiCallCount
          } as any
        })
    } catch (logError) {
      console.error('Failed to log API call summary:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        content_blocks: generatedContentBlocks,
        execution_status: executionStatus,
        successful_generations: successfulGenerations,
        failed_generations: failedGenerations,
        api_call_count: apiCallCount
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
          metadata: { 
            content_type: 'encouragement', 
            error: error.toString(),
            errorType: error.name,
            stack: error.stack
          }
        })
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    // Always return 200 for cron job success, but indicate execution failure in response
    return new Response(
      JSON.stringify({
        success: true, // Cron job succeeded
        execution_status: 'failed',
        error: error.message,
        content_type: 'encouragement'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 