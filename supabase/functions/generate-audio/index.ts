// Last Updated: 2024-07-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock, LogEntry } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'
import { 
  buildTTSRequest, 
  getVoiceConfig, 
  isValidVoice, 
  ELEVEN_LABS_API_BASE, 
  ELEVEN_LABS_TIMEOUT_MS,
  DEFAULT_VOICE 
} from './tts_prompts.ts'

interface ElevenLabsResponse {
  audio: string // base64 encoded audio
  audio_length: number // duration in seconds
}

const BATCH_SIZE = 5 // Match ElevenLabs concurrency limit
const MAX_RETRIES = 3

// Helper function to ensure consistent UTC timestamp handling


// Helper function to validate content block before processing
function validateContentBlock(contentBlock: ContentBlock): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate script exists and is not empty
  if (!contentBlock.script || contentBlock.script.trim().length === 0) {
    errors.push(`Missing or empty script for content block ${contentBlock.id}`)
  }

  // Validate status
  if (contentBlock.status !== ContentBlockStatus.SCRIPT_GENERATED) {
    errors.push(`Invalid status for audio generation: ${contentBlock.status}`)
  }

  // Validate voice
  if (contentBlock.voice && !isValidVoice(contentBlock.voice)) {
    errors.push(`Invalid voice: ${contentBlock.voice}`)
  }

  return { valid: errors.length === 0, errors }
}

async function uploadAudioToStorage(
  supabaseClient: any,
  audioBuffer: ArrayBuffer,
  contentBlockId: string,
  contentType: string,
  voice: string
): Promise<string> {
  try {
    // Create a unique filename with content type folder structure
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${contentType}/${contentBlockId}_${voice}_${timestamp}.aac`
    
    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from('audio-files')
      .upload(filename, audioBuffer, {
        contentType: 'audio/aac',
        cacheControl: '3600', // Cache for 1 hour
        upsert: false // Don't overwrite existing files
      })

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('audio-files')
      .getPublicUrl(filename)

    return urlData.publicUrl

  } catch (error) {
    console.error('Error uploading audio to storage:', error)
    throw error
  }
}

async function generateAudioForContentBlock(
  supabaseClient: any,
  contentBlock: ContentBlock,
  retryCount: number = 0
): Promise<{ success: boolean; audioUrl?: string; duration?: number; error?: string }> {
  try {
    // Get voice configuration
    const voice = contentBlock.voice || DEFAULT_VOICE
    const voiceConfig = getVoiceConfig(voice)

    // Build TTS request
    const ttsRequest = buildTTSRequest(contentBlock.script || '', voice)

    // Get ElevenLabs API key
    const elevenLabsApiKey = Deno.env.get('ELEVEN_LABS_API_KEY')
    console.log(`🔑 ElevenLabs API key configured: ${elevenLabsApiKey ? 'YES' : 'NO'}`)
    
    if (!elevenLabsApiKey) {
      console.error('❌ ElevenLabs API key not configured')
      return { success: false, error: 'ElevenLabs API key not configured - audio generation unavailable' }
    }

    console.log(`🎤 Using voice: ${voice} (${voiceConfig.name})`)
    console.log(`📝 TTS request prepared for text length: ${ttsRequest.text.length}`)

    // Call ElevenLabs API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), ELEVEN_LABS_TIMEOUT_MS)
    
    console.log(`🌐 Calling ElevenLabs API: ${ELEVEN_LABS_API_BASE}/text-to-speech/${voiceConfig.voiceId}`)

    try {
      const response = await fetch(`${ELEVEN_LABS_API_BASE}/text-to-speech/${voiceConfig.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/aac',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey,
        },
        body: JSON.stringify(ttsRequest),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`)
      }

      // Get audio data as ArrayBuffer
      const audioBuffer = await response.arrayBuffer()

      // Upload to Supabase Storage
      const audioUrl = await uploadAudioToStorage(
        supabaseClient,
        audioBuffer,
        contentBlock.id,
        contentBlock.content_type,
        voice
      )

      // Calculate duration (approximate based on text length and voice pacing)
      const textLength = contentBlock.script?.length || 0
      const estimatedDuration = Math.ceil(textLength / 15) // Rough estimate: 15 characters per second

      return { 
        success: true, 
        audioUrl, 
        duration: estimatedDuration 
      }

    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        throw new Error('ElevenLabs API request timed out')
      }
      throw fetchError
    }

  } catch (error) {
    console.error(`Error generating audio for content block ${contentBlock.id}:`, error)
    
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying audio generation for ${contentBlock.id} (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Cap at 10 seconds
      await new Promise(resolve => setTimeout(resolve, delay))
      return generateAudioForContentBlock(supabaseClient, contentBlock, retryCount + 1)
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

    if (currentBlock.status !== ContentBlockStatus.SCRIPT_GENERATED) {
      throw new Error(`Content block ${contentBlock.id} is not in script_generated status (current: ${currentBlock.status})`)
    }

    // Update status to audio_generating with optimistic locking
    const { error: updateError } = await supabaseClient
      .from('content_blocks')
      .update({ 
        status: ContentBlockStatus.AUDIO_GENERATING, 
        updated_at: new Date().toISOString(),
        retry_count: contentBlock.retry_count
      })
      .eq('id', contentBlock.id)
      .eq('status', ContentBlockStatus.SCRIPT_GENERATED) // Optimistic locking
      .eq('updated_at', currentBlock.updated_at)

    if (updateError) {
      throw new Error(`Failed to update content block status: ${updateError.message}`)
    }

    // Generate audio
    const audioResult = await generateAudioForContentBlock(supabaseClient, contentBlock)

    if (audioResult.success && audioResult.audioUrl) { // Update content block with audio URL
      // Use timestamp approach matching generate-script pattern to ensure constraint compliance
      const now = new Date()
      const audioGeneratedAt = new Date(now.getTime() + 1000).toISOString() // Ensure audio_generated_at > script_generated_at
      
      // Log detailed constraint debugging information
      console.log(`🔍 Constraint Debug for ${contentBlock.id}:`)
      console.log(`  - script_generated_at: ${contentBlock.script_generated_at}`)
      console.log(`  - audio_generated_at (to set): ${audioGeneratedAt}`)
      console.log(`  - current status: ${contentBlock.status}`)
      console.log(`  - voice: ${contentBlock.voice}`)
      
      // Fetch current state for debugging
      const { data: currentState, error: fetchError } = await supabaseClient
        .from('content_blocks')
        .select('script_generated_at, audio_generated_at, status, updated_at')
        .eq('id', contentBlock.id)
        .single()
      
      if (!fetchError && currentState) {
        console.log(`  - DB script_generated_at: ${currentState.script_generated_at}`)
        console.log(`  - DB audio_generated_at: ${currentState.audio_generated_at}`)
        console.log(`  - DB status: ${currentState.status}`)
        console.log(`  - DB updated_at: ${currentState.updated_at}`)
      }
      
      const { data: updatedBlock, error: updateError } = await supabaseClient
        .from('content_blocks')
        .update({
          status: ContentBlockStatus.READY,
          audio_url: audioResult.audioUrl,
          duration_seconds: audioResult.duration,
          audio_duration: audioResult.duration,
          audio_generated_at: audioGeneratedAt,
          parameters: {
            ...contentBlock.parameters,
            audio_generated: true,
            audio_duration: audioResult.duration,
            voice_used: contentBlock.voice || DEFAULT_VOICE
          }
        })
        .eq('id', contentBlock.id)
        .select()
        .single()

      if (updateError) {
        console.error(`❌ Update failed for ${contentBlock.id}:`, updateError)
        console.error(`  - Error code: ${updateError.code}`)
        console.error(`  - Error message: ${updateError.message}`)
        console.error(`  - Error details: ${updateError.details}`)
        throw updateError;
      }
      validateObjectShape(updatedBlock, ['id', 'audio_url', 'status'])

      processedCount = 1

      // Log successful audio generation
      await safeLogError(supabaseClient, {
        event_type: 'audio_generation_success',
        status: 'success',
        message: `Audio generated for ${contentBlock.content_type}`,
        content_block_id: contentBlock.id,
        metadata: { 
          content_type: contentBlock.content_type,
          audio_duration: audioResult.duration,
          voice_used: contentBlock.voice || DEFAULT_VOICE
        }
      })

    } else {
      // Audio generation failed
      const { data: failedBlock, error: updateError } = await supabaseClient
        .from('content_blocks')
        .update({
          status: ContentBlockStatus.AUDIO_FAILED,
          parameters: {
            ...contentBlock.parameters,
            audio_generated: false,
            audio_error: audioResult.error
          }
        })
        .eq('id', contentBlock.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      errors.push(`Audio generation failed for ${contentBlock.id}: ${audioResult.error}`)

      // Log audio generation failure
      await safeLogError(supabaseClient, {
        event_type: 'audio_generation_failed',
        status: 'error',
        message: `Audio generation failed for content block ${contentBlock.id}: ${audioResult.error}`,
        content_block_id: contentBlock.id,
        metadata: { 
          content_type: contentBlock.content_type,
          error: audioResult.error 
        }
      })
    }

  } catch (error) {
    console.error(`Error processing content block ${contentBlock.id}:`, error)
    console.error(`  - Error type: ${error.name}`)
    console.error(`  - Error code: ${error.code}`)
    console.error(`  - Error message: ${error.message}`)
    console.error(`  - Error details: ${error.details}`)
    errors.push(`Content block ${contentBlock.id}: ${error.message}`)

    // Update status to audio_failed to prevent stuck content blocks
    // Remove status condition to ensure we always mark as failed regardless of current state
    console.log(`🔄 Attempting to mark ${contentBlock.id} as audio_failed...`)
    try {
      const { data: failedUpdate, error: updateError } = await supabaseClient
        .from('content_blocks')
        .update({
          status: ContentBlockStatus.AUDIO_FAILED,
          updated_at: new Date().toISOString(),
          parameters: {
            ...contentBlock.parameters,
            audio_generated: false,
            audio_error: error.message
          }
        })
        .eq('id', contentBlock.id)
        .select()
        .single()
        // Removed status condition to ensure we always update to failed state

      if (updateError) {
        console.error(`❌ Failed to update status to audio_failed for ${contentBlock.id}:`, updateError)
        console.error(`  - Update error code: ${updateError.code}`)
        console.error(`  - Update error message: ${updateError.message}`)
        console.error(`  - Update error details: ${updateError.details}`)
      } else {
        console.log(`✅ Successfully marked ${contentBlock.id} as audio_failed`)
        console.log(`  - New status: ${failedUpdate.status}`)
        console.log(`  - Updated at: ${failedUpdate.updated_at}`)
      }
    } catch (updateError) {
      console.error(`❌ Exception during audio_failed update for ${contentBlock.id}:`, updateError)
      console.error(`  - Exception type: ${updateError.name}`)
      console.error(`  - Exception message: ${updateError.message}`)
      // Continue with logging even if status update fails
    }

    // Log processing error
    await safeLogError(supabaseClient, {
      event_type: 'audio_processing_failed',
      status: 'error',
      message: `Audio processing failed for content block ${contentBlock.id}: ${error.message}`,
      content_block_id: contentBlock.id,
      metadata: { 
        content_type: contentBlock.content_type,
        error: error.toString() 
      }
    })
  }

  return { success: errors.length === 0, processedCount, errors }
}

async function processBatch(supabaseClient: any): Promise<{ 
  success: boolean; 
  processedCount: number; 
  totalErrors: number; 
  errors: string[] 
}> {
  console.log('🔍 processBatch: Starting batch processing')
  const errors: string[] = []
  let totalProcessed = 0
  let totalErrors = 0
  try {
    console.log('📊 processBatch: Fetching content blocks from database...')
    // Fetch content blocks that need audio generation
    const { data: contentBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .eq('status', ContentBlockStatus.SCRIPT_GENERATED)
      .not('script', 'is', null)
      .order('content_priority', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('❌ processBatch: Database fetch error:', fetchError)
      throw new Error(`Failed to fetch content blocks: ${fetchError.message}`)
    }

    console.log(`📊 processBatch: Found ${contentBlocks?.length || 0} content blocks`)
    
    if (!contentBlocks || contentBlocks.length === 0) {
      console.log('ℹ️ processBatch: No content blocks to process')
      return { success: true, processedCount: 0, totalErrors: 0, errors: [] }
    }

    console.log(`Processing ${contentBlocks.length} content blocks for audio generation`)

    // Process each content block
    for (const contentBlock of contentBlocks) {
      try {
        validateObjectShape(contentBlock, ['id', 'content_type', 'script', 'status'])
        const result = await processContentBlock(supabaseClient, contentBlock)
        
        totalProcessed += result.processedCount
        errors.push(...result.errors)
        
        if (!result.success) {
          totalErrors++
        }
      } catch (error) {
        console.error(`Error processing content block ${contentBlock.id}:`, error)
        errors.push(`Content block ${contentBlock.id}: ${error.message}`)
        totalErrors++
      }
    }

    return { 
      success: totalErrors === 0, 
      processedCount: totalProcessed, 
      totalErrors, 
      errors 
    }

  } catch (error) {
    console.error('Error in processBatch:', error)
    errors.push(`Batch processing error: ${error.message}`)
    return { success: false, processedCount: totalProcessed, totalErrors: errors.length, errors }
  }
}

async function processBatchAsync(supabaseClient: any): Promise<void> {
  try {
    console.log('Starting async audio generation batch')
    const result = await processBatch(supabaseClient)
    
    console.log(`Async batch completed: ${result.processedCount} processed, ${result.totalErrors} errors`)
    
    // Log batch completion
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_batch_complete',
      status: result.success ? 'success' : 'partial_success',
      message: `Audio generation batch completed: ${result.processedCount} processed, ${result.totalErrors} errors`,
      metadata: { 
        processed_count: result.processedCount,
        error_count: result.totalErrors,
        batch_size: BATCH_SIZE
      }
    })

  } catch (error) {
    console.error('Error in async batch processing:', error)
    
    // Log batch failure
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_batch_failed',
      status: 'error',
      message: `Audio generation batch failed: ${error.message}`,
      metadata: { 
        error: error.toString(),
        batch_size: BATCH_SIZE
      }
    })
  }
}

serve(async (req) => {
  // Enhanced logging for diagnosis - 2025-07-20
  console.log('🚀 generate-audio function invoked')
  console.log(`📝 Request method: ${req.method}`)
  console.log(`🌐 Request URL: ${req.url}`)
  console.log(`📅 Timestamp: ${new Date().toISOString()}`)
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🔍 Validating environment variables...')
  try {
    // Validate required environment variables
    validateEnvVars([
      'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
      'ELEVEN_LABS_API_KEY'
    ])
    console.log('✅ Environment variables validated successfully')
  } catch (envError) {
    console.error('❌ Environment validation failed:', envError.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: `Environment validation failed: ${envError.message}`,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }

  // Handle health check requests
  const url = new URL(req.url)
  console.log(`🔍 Checking if this is a health check request...`)
  console.log(`📍 Pathname: ${url.pathname}`)
  
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    console.log('🏥 Health check request detected')
    try {
      const response = {
        status: 'healthy',
        function: 'generate-audio',
        timestamp: new Date().toISOString(),
        environment: {
          hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
          hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          hasElevenLabsKey: !!Deno.env.get('ELEVEN_LABS_API_KEY')
        }
      }
      console.log('✅ Health check response prepared:', response)
      return new Response(
        JSON.stringify(response),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    } catch (healthError) {
      console.error('❌ Health check error:', healthError)
      return new Response(
        JSON.stringify({
          status: 'error',
          function: 'generate-audio',
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
  console.log(`🔍 Validating HTTP method: ${req.method}`)
  if (req.method !== 'POST') {
    console.log(`❌ Invalid HTTP method: ${req.method}`)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Method ${req.method} not allowed. Use POST.` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405     }
    )
  }

  console.log('✅ HTTP method validation passed')
  console.log('🔧 Initializing Supabase client...')
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    console.log(`🌐 Supabase URL configured: ${supabaseUrl ? 'YES' : 'NO'}`)
    console.log(`🔑 Service role key configured: ${serviceRoleKey ? 'YES' : 'NO'}`)
    
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey)
    console.log('✅ Supabase client initialized successfully')

    // Check if this is a cron job request (immediate response needed)
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const cronHeader = req.headers.get('x-cron-job')
    
    console.log(`🤖 User-Agent: ${userAgent}`)
    console.log(`⏰ Cron header: ${cronHeader}`)
    
    const isCronJob = userAgent.includes('cron-job.org') || cronHeader === 'true'
    console.log(`🔄 Is cron job: ${isCronJob}`)

    if (isCronJob) {
      console.log('⏰ Cron job detected - starting async processing')
      // Start async processing without waiting
      processBatchAsync(supabaseClient).catch(error => {
        console.error('❌ Async processing error:', error)
      })
      
      console.log('✅ Returning immediate success response for cron job')
      // Return immediate success response
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Audio generation batch initiated asynchronously',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // For non-cron requests, process synchronously (for manual testing)
    console.log('🔄 Starting synchronous batch processing for manual request')
    let executionStatus = 'completed'
    let result: any = null
    
    try {
      result = await processBatch(supabaseClient)
      console.log(`📊 Batch processing completed:`, {
        success: result.success,
        processedCount: result.processedCount,
        totalErrors: result.totalErrors,
        errors: result.errors
      })

      // Determine execution status based on results
      if (result.totalErrors > 0 && result.processedCount === 0) {
        executionStatus = 'completed_with_errors'
        console.log('❌ Execution status: completed_with_errors')
      } else if (result.totalErrors > 0) {
        executionStatus = 'completed_with_warnings'
        console.log('⚠️ Execution status: completed_with_warnings')
      } else {
        console.log('✅ Execution status: completed')
      }
    } catch (batchError) {
      console.error('❌ Batch processing failed:', batchError)
      executionStatus = 'failed'
    }

    // Log batch completion
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_batch_complete',
      status: result.success ? 'success' : 'partial_success',
      message: `Audio generation batch completed: ${result.processedCount} processed, ${result.totalErrors} errors`,
      metadata: { 
        processed_count: result.processedCount,
        error_count: result.totalErrors,
        batch_size: BATCH_SIZE,
        execution_status: executionStatus
      }
    })

    return new Response(
      JSON.stringify({
        success: true, // Always true for cron job success
        execution_status: executionStatus,
        processed_count: result.processedCount,
        error_count: result.totalErrors,
        errors: result.errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )

  } catch (error) {
    console.error('Error in generate-audio function:', error)

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await safeLogError(supabaseClient, {
        event_type: 'audio_generation_batch_failed',
        status: 'error',
        message: `Audio generation batch failed: ${error.message}`,
        metadata: { 
          error: error.toString(),
          batch_size: BATCH_SIZE
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
        content_type: 'audio_generation'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 