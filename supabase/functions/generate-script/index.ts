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
      return { success: false, error: 'OpenAI API key not configured - script generation unavailable' }
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
          const now = new Date().toISOString()
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
            created_at: now,
            script_generated_at: now,
            updated_at: now
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

async function processBatch(supabaseClient: any): Promise<{ 
  success: boolean; 
  processedCount: number; 
  totalErrors: number; 
  errors: string[] 
}> {
  let totalProcessed = 0
  let totalErrors = 0
  const allErrors: string[] = []

  try {
    // Fetch content blocks ready for script generation
    const { data: contentBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .eq('status', 'content_ready')
      .order('content_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch content blocks: ${fetchError.message}`)
    }

    if (!contentBlocks || contentBlocks.length === 0) {
      console.log('No content blocks found with content_ready status')
      
      // Log that no content blocks were found
      await safeLogError(supabaseClient, {
        event_type: 'script_generation_no_content',
        status: 'info',
        message: 'No content blocks found with content_ready status',
        metadata: {
          batch_size: BATCH_SIZE,
          status_filter: 'content_ready'
        }
      })
      
      return { success: true, processedCount: 0, totalErrors: 0, errors: [] }
    }

    console.log(`Found ${contentBlocks.length} content blocks ready for script generation`)

    // Log batch start
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_batch_started',
      status: 'info',
      message: `Starting script generation batch for ${contentBlocks.length} content blocks`,
      metadata: {
        content_block_count: contentBlocks.length,
        batch_size: BATCH_SIZE
      }
    })

    // Process each content block
    for (const contentBlock of contentBlocks) {
      const result = await processContentBlock(supabaseClient, contentBlock)
      totalProcessed += result.processedCount
      totalErrors += result.errors.length
      allErrors.push(...result.errors)
    }

    return { 
      success: totalProcessed > 0, 
      processedCount: totalProcessed, 
      totalErrors, 
      errors: allErrors 
    }

  } catch (error) {
    console.error('Error in processBatch:', error)
    
    // Log error to database
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_batch_failed',
      status: 'error',
      message: `Script generation batch failed: ${error.message}`,
      metadata: { 
        error: error.toString(),
        errorType: error.name,
        batch_size: BATCH_SIZE
      }
    })

    return { 
      success: false, 
      processedCount: totalProcessed, 
      totalErrors: totalErrors + 1, 
      errors: [...allErrors, error.message] 
    }
  }
}

async function processBatchAsync(supabaseClient: any): Promise<void> {
  try {
    console.log('🔄 Starting async batch processing')
    
    // Fetch content blocks ready for script generation
    const { data: contentBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .eq('status', 'content_ready')
      .order('content_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch content blocks: ${fetchError.message}`)
    }

    if (!contentBlocks || contentBlocks.length === 0) {
      console.log('No content blocks found with content_ready status')
      return
    }

    console.log(`Found ${contentBlocks.length} content blocks ready for script generation`)

    // Log batch start
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_async_batch_started',
      status: 'info',
      message: `Starting async script generation batch for ${contentBlocks.length} content blocks`,
      metadata: {
        content_block_count: contentBlocks.length,
        batch_size: BATCH_SIZE
      }
    })

    // Process each content block asynchronously
    const processingPromises = contentBlocks.map(async (contentBlock) => {
      try {
        // Mark as processing to prevent duplicate processing
        const { error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({ 
            status: 'script_generating', 
            updated_at: new Date().toISOString()
          })
          .eq('id', contentBlock.id)
          .eq('status', 'content_ready') // Optimistic locking

        if (updateError) {
          console.error(`Failed to mark ${contentBlock.id} as processing:`, updateError)
          return
        }

        // Process the content block
        const result = await processContentBlock(supabaseClient, contentBlock)
        
        if (!result.success) {
          console.error(`Failed to process content block ${contentBlock.id}:`, result.errors)
        }
      } catch (error) {
        console.error(`Error processing content block ${contentBlock.id}:`, error)
        
        // Mark as failed
        await supabaseClient
          .from('content_blocks')
          .update({ 
            status: 'script_failed',
            updated_at: new Date().toISOString(),
            retry_count: (contentBlock.retry_count || 0) + 1
          })
          .eq('id', contentBlock.id)
      }
    })

    // Wait for all processing to complete
    await Promise.allSettled(processingPromises)

    console.log('🔄 Async batch processing completed')

  } catch (error) {
    console.error('🔄 Error in async batch processing:', error)
    
    // Log error to database
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_async_batch_failed',
      status: 'error',
      message: `Async script generation batch failed: ${error.message}`,
      metadata: { 
        error: error.toString(),
        errorType: error.name,
        batch_size: BATCH_SIZE
      }
    })
  }
}

serve(async (req) => {
  console.log('🔍 generate-script function called')
  console.log('🔍 Request method:', req.method)
  console.log('🔍 Request URL:', req.url)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('🔍 Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests - more explicit handling
  const url = new URL(req.url)
  console.log('🔍 URL pathname:', url.pathname)
  
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    console.log('🔍 Handling health check request')
    try {
      const response = {
        status: 'healthy',
        function: 'generate-script',
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
          function: 'generate-script',
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
    console.log('🔍 Starting main function logic')
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    console.log('🔍 Supabase URL exists:', !!supabaseUrl)
    console.log('🔍 Supabase Service Key exists:', !!supabaseServiceKey)

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('🔍 Missing Supabase configuration')
      throw new Error('Missing Supabase configuration')
    }

    console.log('🔍 Creating Supabase client')
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    console.log('🔍 Supabase client created successfully')

    // Check if this is a cron job request (immediate response needed)
    const isCronJob = req.headers.get('user-agent')?.includes('cron-job.org') || 
                     req.headers.get('x-cron-job') === 'true'

    if (isCronJob) {
      console.log('🕐 Cron job detected - starting async processing')
      try {
        // Start async processing without waiting
        processBatchAsync(supabaseClient).catch(error => {
          console.error('🔄 Async processing error:', error)
        })
      } catch (asyncError) {
        // Log but do not fail the HTTP response
        console.error('🔄 Error launching async batch:', asyncError)
      }
      // Return immediate success response (always 200)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Script generation batch initiated asynchronously',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

         // For non-cron requests, process synchronously (for manual testing)
     console.log('🔍 Processing synchronously for manual request')
     const result = await processBatch(supabaseClient)

    // Log batch completion
    await safeLogError(supabaseClient, {
      event_type: 'script_generation_batch_complete',
      status: result.success ? 'success' : 'partial_success',
      message: `Script generation batch completed: ${result.processedCount} processed, ${result.totalErrors} errors`,
      metadata: {
        processed_count: result.processedCount,
        error_count: result.totalErrors,
        batch_size: BATCH_SIZE
      }
    })

    return new Response(
      JSON.stringify({
        success: result.success,
        processed_count: result.processedCount,
        error_count: result.totalErrors,
        errors: result.errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 207 // 207 Multi-Status for partial success
      }
    )

  } catch (error) {
    console.error('🔍 Error in generate-script function:', error)
    console.error('🔍 Error stack:', error.stack)
    console.error('🔍 Error name:', error.name)
    console.error('🔍 Error message:', error.message)

    // Log error to logs table with safe error handling
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
            errorType: error.name,
            batch_size: BATCH_SIZE
          }
        })
      }
    } catch (logError) {
      console.error('🔍 Failed to log error to database:', logError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
}) 