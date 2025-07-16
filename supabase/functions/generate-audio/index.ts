import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  buildTTSRequest, 
  getVoiceConfig, 
  isValidVoice, 
  ELEVEN_LABS_API_BASE, 
  ELEVEN_LABS_TIMEOUT_MS,
  DEFAULT_VOICE 
} from './tts_prompts.ts'

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

interface ElevenLabsResponse {
  audio: string // base64 encoded audio
  audio_length: number // duration in seconds
}

const BATCH_SIZE = 5 // Match ElevenLabs concurrency limit
const MAX_RETRIES = 3

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

  // Validate script exists and is not empty
  if (!contentBlock.script || contentBlock.script.trim().length === 0) {
    errors.push(`Missing or empty script for content block ${contentBlock.id}`)
  }

  // Validate status
  if (contentBlock.status !== 'script_generated') {
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
    const filename = `${contentType}/${contentBlockId}_${voice}_${timestamp}.mp3`
    
    // Upload to Supabase Storage
    const { data, error } = await supabaseClient.storage
      .from('audio-files')
      .upload(filename, audioBuffer, {
        contentType: 'audio/mpeg',
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
    if (!elevenLabsApiKey) {
      return { success: false, error: 'ElevenLabs API key not configured - audio generation unavailable' }
    }

    // Call ElevenLabs API with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), ELEVEN_LABS_TIMEOUT_MS)

    try {
      const response = await fetch(`${ELEVEN_LABS_API_BASE}/text-to-speech/${voiceConfig.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
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

    if (currentBlock.status !== 'script_generated') {
      throw new Error(`Content block ${contentBlock.id} is not in script_generated status (current: ${currentBlock.status})`)
    }

    // Update status to audio_generating with optimistic locking
    const { error: updateError } = await supabaseClient
      .from('content_blocks')
      .update({ 
        status: 'audio_generating', 
        updated_at: new Date().toISOString(),
        retry_count: contentBlock.retry_count
      })
      .eq('id', contentBlock.id)
      .eq('status', 'script_generated') // Optimistic locking

    if (updateError) {
      throw new Error(`Failed to update content block status: ${updateError.message}`)
    }

    // Generate audio
    const audioResult = await generateAudioForContentBlock(supabaseClient, contentBlock)

    if (!audioResult.success) {
      // Update status to audio_failed
      await supabaseClient
        .from('content_blocks')
        .update({ 
          status: 'audio_failed',
          updated_at: new Date().toISOString(),
          retry_count: contentBlock.retry_count + 1
        })
        .eq('id', contentBlock.id)

      throw new Error(`Audio generation failed: ${audioResult.error}`)
    }

    // Update with successful audio generation
    const { error: finalUpdateError } = await supabaseClient
      .from('content_blocks')
      .update({
        status: 'ready',
        audio_url: audioResult.audioUrl,
        duration_seconds: audioResult.duration,
        audio_generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', contentBlock.id)

    if (finalUpdateError) {
      throw new Error(`Failed to update content block with audio data: ${finalUpdateError.message}`)
    }

    processedCount = 1

    // Log success
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_success',
      status: 'success',
      message: `Audio generated successfully for content block ${contentBlock.id}`,
      content_block_id: contentBlock.id,
      metadata: {
        content_type: contentBlock.content_type,
        voice: contentBlock.voice || DEFAULT_VOICE,
        duration: audioResult.duration
      }
    })

  } catch (error) {
    console.error(`Error processing content block ${contentBlock.id}:`, error)
    errors.push(`Content block ${contentBlock.id}: ${error.message}`)

    // Log error
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_error',
      status: 'error',
      message: `Audio generation failed for content block ${contentBlock.id}: ${error.message}`,
      content_block_id: contentBlock.id,
      metadata: {
        content_type: contentBlock.content_type,
        voice: contentBlock.voice || DEFAULT_VOICE,
        retry_count: contentBlock.retry_count
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
    // Fetch content blocks ready for audio generation
    const { data: contentBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .eq('status', 'script_generated')
      .order('content_priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch content blocks: ${fetchError.message}`)
    }

    if (!contentBlocks || contentBlocks.length === 0) {
      console.log('No content blocks found with script_generated status')
      
      // Log that no content blocks were found
      await safeLogError(supabaseClient, {
        event_type: 'audio_generation_no_content',
        status: 'info',
        message: 'No content blocks found with script_generated status',
        metadata: {
          batch_size: BATCH_SIZE,
          status_filter: 'script_generated'
        }
      })
      
      return { success: true, processedCount: 0, totalErrors: 0, errors: [] }
    }

    console.log(`Found ${contentBlocks.length} content blocks ready for audio generation`)

    // Log batch start
    await safeLogError(supabaseClient, {
      event_type: 'audio_generation_batch_started',
      status: 'info',
      message: `Starting audio generation batch for ${contentBlocks.length} content blocks`,
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

    console.log(`Audio generation batch complete: ${totalProcessed} processed, ${totalErrors} errors`)

  } catch (error) {
    console.error('Error in audio generation batch:', error)
    allErrors.push(`Batch processing error: ${error.message}`)
    totalErrors++
  }

  return { 
    success: totalErrors === 0, 
    processedCount: totalProcessed, 
    totalErrors, 
    errors: allErrors 
  }
}

serve(async (req) => {
  console.log('🔍 generate-audio function called')
  console.log('🔍 Request method:', req.method)
  console.log('🔍 Request URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔍 Handling CORS preflight')
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests
  const url = new URL(req.url)
  console.log('🔍 URL pathname:', url.pathname)
  
  if (url.pathname === '/health' || req.method === 'GET') {
    console.log('🔍 Handling health check request')
    try {
      const response = {
        status: 'healthy',
        function: 'generate-audio',
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

    // Process batch
    const result = await processBatch(supabaseClient)

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
    console.error('🔍 Error in generate-audio function:', error)
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
          event_type: 'audio_generation_batch_failed',
          status: 'error',
          message: `Audio generation batch failed: ${error.message}`,
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