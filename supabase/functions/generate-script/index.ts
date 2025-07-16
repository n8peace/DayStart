import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateFullPrompt, PromptParameters, getPromptForContentType, isValidContentType } from './prompts.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContentBlock {
  id: string
  user_id?: string
  content_type: string
  date: string
  content?: string
  script?: string
  audio_url?: string
  status: string
  voice?: string
  duration_seconds?: number
  retry_count: number
  content_priority: number
  expiration_date: string
  language_code: string
  parameters?: any
  created_at: string
  updated_at: string
  script_generated_at?: string
  audio_generated_at?: string
}

interface LogEntry {
  event_type: string
  status: string
  message: string
  metadata?: any
  content_block_id?: string
}

interface GPT4oResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

const BATCH_SIZE = 100
const MAX_RETRIES = 3
const VALID_VOICES = ['voice_1', 'voice_2', 'voice_3']
const GPT_TIMEOUT_MS = 30000 // 30 seconds timeout for GPT-4o calls

// Helper function to validate voice
function isValidVoice(voice: string): voice is 'voice_1' | 'voice_2' | 'voice_3' {
  return VALID_VOICES.includes(voice)
}

// Helper function to safely log errors
async function safeLogError(supabaseClient: any, logData: Partial<LogEntry>): Promise<void> {
  try {
    await supabaseClient
      .from('logs')
      .insert(logData)
  } catch (logError) {
    console.error('Failed to log error:', logError)
  }
}

// Helper function to validate content block before processing
function validateContentBlock(contentBlock: ContentBlock): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate content type
  if (!isValidContentType(contentBlock.content_type)) {
    errors.push(`Invalid content type: ${contentBlock.content_type}`)
  }

  // Validate content exists and is not empty
  if (!contentBlock.content || contentBlock.content.trim().length === 0) {
    errors.push(`Missing or empty content for content block ${contentBlock.id}`)
  }

  // Validate status
  if (contentBlock.status !== 'content_ready') {
    errors.push(`Invalid status for processing: ${contentBlock.status}`)
  }

  // Validate date
  if (!contentBlock.date) {
    errors.push(`Missing date for content block ${contentBlock.id}`)
  }

  return { valid: errors.length === 0, errors }
}

async function generateScriptForVoice(
  supabaseClient: any,
  contentBlock: ContentBlock,
  voice: string,
  retryCount: number = 0
): Promise<{ success: boolean; script?: string; error?: string }> {
  try {
    // Validate voice
    if (!isValidVoice(voice)) {
      throw new Error(`Invalid voice: ${voice}`)
    }

    // Get UTC date for content generation
    const targetDate = contentBlock.date
    const dayOfWeek = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' })

    // Prepare parameters for GPT-4o
    const promptParams: PromptParameters = {
      date: targetDate,
      dayOfWeek,
      voice,
      ...contentBlock.parameters // Pass parameters as-is
    }

    // Generate prompt for the content type
    const prompt = generateFullPrompt(contentBlock.content_type, contentBlock.content || '', promptParams)
    if (!prompt) {
      throw new Error(`Unsupported content type: ${contentBlock.content_type}`)
    }

    // Get prompt configuration for tokens and temperature
    const promptConfig = getPromptForContentType(contentBlock.content_type)

    // Call GPT-4o API with timeout
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GPT_TIMEOUT_MS)

    try {
      const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: prompt.systemPrompt },
            { role: 'user', content: prompt.userPrompt }
          ],
          max_tokens: promptConfig?.maxTokens || 200,
          temperature: promptConfig?.temperature || 0.7,
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!gptResponse.ok) {
        const errorText = await gptResponse.text()
        throw new Error(`GPT-4o API error: ${gptResponse.status} - ${errorText}`)
      }

      const gptData: GPT4oResponse = await gptResponse.json()
      
      // Comprehensive validation of GPT response structure
      if (!gptData.choices || !Array.isArray(gptData.choices) || gptData.choices.length === 0) {
        throw new Error('GPT-4o returned empty choices array')
      }

      const firstChoice = gptData.choices[0]
      if (!firstChoice.message || typeof firstChoice.message.content !== 'string') {
        throw new Error('GPT-4o returned invalid message structure')
      }

      const generatedScript = firstChoice.message.content.trim()

      if (!generatedScript) {
        throw new Error('No script generated from GPT-4o')
      }

      return { success: true, script: generatedScript }

    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('GPT-4o API request timed out')
      }
      throw fetchError
    }

  } catch (error) {
    console.error(`Error generating script for voice ${voice}:`, error)
    
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying voice ${voice} (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Cap at 10 seconds
      await new Promise(resolve => setTimeout(resolve, delay))
      return generateScriptForVoice(supabaseClient, contentBlock, voice, retryCount + 1)
    }

    return { success: false, error: error.message }
  }
}

async function processContentBlock(
  supabaseClient: any,
  contentBlock: ContentBlock
): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
  const errors: string[] = []
  let processedCount = 0

  try {
    // Validate content block before processing
    const validation = validateContentBlock(contentBlock)
    if (!validation.valid) {
      errors.push(...validation.errors)
      return { success: false, processedCount: 0, errors }
    }

    // Use optimistic locking to prevent race conditions
    const { data: currentBlock, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('status, updated_at')
      .eq('id', contentBlock.id)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch current content block: ${fetchError.message}`)
    }

    if (!currentBlock) {
      throw new Error(`Content block ${contentBlock.id} not found`)
    }

    if (currentBlock.status !== 'content_ready') {
      throw new Error(`Content block ${contentBlock.id} is not in content_ready status (current: ${currentBlock.status})`)
    }

    // Update status to script_generating with optimistic locking
    const { error: updateError } = await supabaseClient
      .from('content_blocks')
      .update({ 
        status: 'script_generating', 
        updated_at: new Date().toISOString(),
        retry_count: contentBlock.retry_count
      })
      .eq('id', contentBlock.id)
      .eq('status', 'content_ready') // Optimistic locking
      .eq('updated_at', currentBlock.updated_at)

    if (updateError) {
      throw new Error(`Failed to update status (possible race condition): ${updateError.message}`)
    }

    // Log start of processing
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_started',
      status: 'info',
      message: `Starting script generation for ${contentBlock.content_type}`,
      content_block_id: contentBlock.id,
      metadata: { 
        content_type: contentBlock.content_type, 
        date: contentBlock.date, 
        user_id: contentBlock.user_id,
        is_user_content: !!contentBlock.user_id
      }
    })

    if (contentBlock.user_id) {
      // User-specific content - generate single script
      const voice = contentBlock.voice && isValidVoice(contentBlock.voice) ? contentBlock.voice : 'voice_1'
      const result = await generateScriptForVoice(supabaseClient, contentBlock, voice)
      
      if (result.success && result.script) {
        // Update original row with generated script
        const now = new Date().toISOString()
        const { error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            script: result.script,
            status: 'script_generated',
            script_generated_at: now,
            updated_at: now,
            retry_count: 0,
            voice: voice
          })
          .eq('id', contentBlock.id)

        if (updateError) {
          errors.push(`Failed to update user content: ${updateError.message}`)
        } else {
          processedCount = 1
          
          // Log successful generation
          await safeLogError(supabaseClient, {
            event_type: 'script_generated',
            status: 'success',
            message: `Script generated successfully for user content`,
            content_block_id: contentBlock.id,
            metadata: { 
              content_type: contentBlock.content_type, 
              date: contentBlock.date, 
              user_id: contentBlock.user_id,
              voice: voice,
              script_length: result.script.length
            }
          })
        }
      } else {
        // Mark as failed
        const { error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            status: 'script_failed',
            updated_at: new Date().toISOString(),
            retry_count: MAX_RETRIES
          })
          .eq('id', contentBlock.id)

        if (updateError) {
          errors.push(`Failed to mark as failed: ${updateError.message}`)
        }

        errors.push(`Script generation failed for user content: ${result.error}`)
        
        // Log failure
        await safeLogError(supabaseClient, {
          event_type: 'script_generation_failed',
          status: 'error',
          message: `Script generation failed for user content: ${result.error}`,
          content_block_id: contentBlock.id,
          metadata: { 
            content_type: contentBlock.content_type, 
            date: contentBlock.date, 
            user_id: contentBlock.user_id,
            voice: voice,
            retry_count: MAX_RETRIES
          }
        })
      }
    } else {
      // Shared content - generate scripts for all 3 voices
      const voices = ['voice_1', 'voice_2', 'voice_3'] as const
      const results = await Promise.all(
        voices.map(voice => generateScriptForVoice(supabaseClient, contentBlock, voice))
      )

      // Update original row to become voice_1
      if (results[0].success && results[0].script) {
        const now = new Date().toISOString()
        const { error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            script: results[0].script,
            status: 'script_generated',
            script_generated_at: now,
            updated_at: now,
            retry_count: 0,
            voice: 'voice_1'
          })
          .eq('id', contentBlock.id)

        if (updateError) {
          errors.push(`Failed to update voice_1: ${updateError.message}`)
        } else {
          processedCount++
          
          // Log successful voice_1 generation
          await safeLogError(supabaseClient, {
            event_type: 'script_generated',
            status: 'success',
            message: `Script generated successfully for voice_1`,
            content_block_id: contentBlock.id,
            metadata: { 
              content_type: contentBlock.content_type, 
              date: contentBlock.date, 
              voice: 'voice_1',
              script_length: results[0].script!.length
            }
          })
        }
      } else {
        // Mark original as failed if voice_1 fails
        const { error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            status: 'script_failed',
            updated_at: new Date().toISOString(),
            retry_count: MAX_RETRIES
          })
          .eq('id', contentBlock.id)

        if (updateError) {
          errors.push(`Failed to mark voice_1 as failed: ${updateError.message}`)
        }

        errors.push(`Script generation failed for voice_1: ${results[0].error}`)
        
        // Log voice_1 failure
        await safeLogError(supabaseClient, {
          event_type: 'script_generation_failed',
          status: 'error',
          message: `Script generation failed for voice_1: ${results[0].error}`,
          content_block_id: contentBlock.id,
          metadata: { 
            content_type: contentBlock.content_type, 
            date: contentBlock.date, 
            voice: 'voice_1',
            retry_count: MAX_RETRIES
          }
        })
      }

      // Create new rows for voice_2 and voice_3
      for (let i = 1; i < voices.length; i++) {
        const voice = voices[i]
        const result = results[i]
        
        if (result.success && result.script) {
          // Create new row for this voice
          const newContentBlock: Partial<ContentBlock> = {
            user_id: contentBlock.user_id,
            content_type: contentBlock.content_type,
            date: contentBlock.date,
            content: contentBlock.content,
            script: result.script,
            status: 'script_generated',
            voice: voice,
            retry_count: 0,
            content_priority: contentBlock.content_priority,
            expiration_date: contentBlock.expiration_date,
            language_code: contentBlock.language_code,
            parameters: contentBlock.parameters,
            script_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          const { data: newRow, error: insertError } = await supabaseClient
            .from('content_blocks')
            .insert(newContentBlock)
            .select()
            .single()

          if (insertError) {
            errors.push(`Failed to create ${voice} row: ${insertError.message}`)
          } else {
            processedCount++
            
            // Log successful generation for this voice
            await safeLogError(supabaseClient, {
              event_type: 'script_generated',
              status: 'success',
              message: `Script generated successfully for ${voice}`,
              content_block_id: newRow.id,
              metadata: { 
                content_type: contentBlock.content_type, 
                date: contentBlock.date, 
                voice: voice,
                script_length: result.script!.length,
                original_content_block_id: contentBlock.id
              }
            })
          }
        } else {
          // Log failure for this voice
          await safeLogError(supabaseClient, {
            event_type: 'script_generation_failed',
            status: 'error',
            message: `Script generation failed for ${voice}: ${result.error}`,
            metadata: { 
              content_type: contentBlock.content_type, 
              date: contentBlock.date, 
              voice: voice,
              retry_count: MAX_RETRIES,
              original_content_block_id: contentBlock.id
            }
          })

          errors.push(`Script generation failed for ${voice}: ${result.error}`)
        }
      }
    }

  } catch (error) {
    console.error('Error processing content block:', error)
    errors.push(`Processing error: ${error.message}`)
    
    // Log processing error
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_failed',
      status: 'error',
      message: `Content block processing failed: ${error.message}`,
      content_block_id: contentBlock.id,
      metadata: { 
        content_type: contentBlock.content_type, 
        date: contentBlock.date, 
        user_id: contentBlock.user_id,
        error: error.toString()
      }
    })
  }

  return { success: processedCount > 0, processedCount, errors }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate HTTP method
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Method ${req.method} not allowed. Use POST or GET.` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405 
      }
    )
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required Supabase environment variables')
    }

    if (!openaiApiKey) {
      throw new Error('Missing OpenAI API key')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get content_ready rows (up to BATCH_SIZE)
    const { data: contentBlocks, error: queryError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .eq('status', 'content_ready')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (queryError) {
      throw new Error(`Failed to query content blocks: ${queryError.message}`)
    }

    if (!contentBlocks || contentBlocks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No content_ready rows found',
          processed_count: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    console.log(`Processing ${contentBlocks.length} content blocks`)

    // Process each content block
    const results = []
    let totalProcessed = 0
    let totalErrors = 0

    for (const contentBlock of contentBlocks) {
      const result = await processContentBlock(supabaseClient, contentBlock)
      results.push({
        content_block_id: contentBlock.id,
        content_type: contentBlock.content_type,
        user_id: contentBlock.user_id,
        success: result.success,
        processed_count: result.processedCount,
        errors: result.errors
      })
      
      totalProcessed += result.processedCount
      totalErrors += result.errors.length
    }

    // Log batch completion
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_batch_completed',
      status: 'success',
      message: `Script generation batch completed`,
      metadata: { 
        total_content_blocks: contentBlocks.length,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        batch_size: BATCH_SIZE
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Script generation batch completed',
        total_content_blocks: contentBlocks.length,
        total_processed: totalProcessed,
        total_errors: totalErrors,
        results: results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in generate-script function:', error)

    // Log error with safe error handling
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
        
        await safeLogError(supabaseClient, {
          event_type: 'script_generation_batch_failed',
          status: 'error',
          message: `Script generation batch failed: ${error.message}`,
          metadata: { 
            error: error.toString(),
            batch_size: BATCH_SIZE
          }
        })
      }
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