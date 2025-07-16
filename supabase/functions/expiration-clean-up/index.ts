import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContentBlock {
  id: string
  user_id?: string
  content_type: string
  date: string
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

interface CleanupResult {
  success: boolean
  processedCount: number
  deletedAudioCount: number
  errors: string[]
}

const BATCH_SIZE = 50 // Process in batches to avoid timeouts

// Helper function to safely log operations
async function safeLog(supabaseClient: any, logData: Partial<LogEntry>): Promise<void> {
  try {
    await supabaseClient
      .from('logs')
      .insert(logData)
  } catch (logError) {
    console.error('Failed to log operation:', logError)
  }
}

// Helper function to extract storage path from audio URL
function extractStoragePath(audioUrl: string): string | null {
  try {
    const url = new URL(audioUrl)
    // Extract path after the bucket name
    // URL format: https://xxx.supabase.co/storage/v1/object/public/audio-files/{path}
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/audio-files\/(.+)/)
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null
  } catch (error) {
    console.error('Error extracting storage path from URL:', error)
    return null
  }
}

// Helper function to delete audio file from storage
async function deleteAudioFromStorage(
  supabaseClient: any,
  audioUrl: string,
  contentBlockId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const storagePath = extractStoragePath(audioUrl)
    if (!storagePath) {
      return { 
        success: false, 
        error: `Could not extract storage path from URL for content block ${contentBlockId}` 
      }
    }

    const { error } = await supabaseClient.storage
      .from('audio-files')
      .remove([storagePath])

    if (error) {
      return { 
        success: false, 
        error: `Storage deletion failed for ${contentBlockId}: ${error.message}` 
      }
    }

    return { success: true }

  } catch (error) {
    return { 
      success: false, 
      error: `Unexpected error deleting audio for ${contentBlockId}: ${error.message}` 
    }
  }
}

// Helper function to update content block after cleanup
async function updateContentBlockAfterCleanup(
  supabaseClient: any,
  contentBlockId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from('content_blocks')
      .update({
        audio_url: null,
        status: 'expired',
        updated_at: new Date().toISOString()
      })
      .eq('id', contentBlockId)

    if (error) {
      return { 
        success: false, 
        error: `Database update failed for ${contentBlockId}: ${error.message}` 
      }
    }

    return { success: true }

  } catch (error) {
    return { 
      success: false, 
      error: `Unexpected error updating content block ${contentBlockId}: ${error.message}` 
    }
  }
}

// Main function to process a single content block
async function processExpiredContentBlock(
  supabaseClient: any,
  contentBlock: ContentBlock
): Promise<{ success: boolean; audioDeleted: boolean; error?: string }> {
  try {
    // Skip if no audio URL
    if (!contentBlock.audio_url) {
      return { success: true, audioDeleted: false }
    }

    // Delete audio from storage
    const storageResult = await deleteAudioFromStorage(
      supabaseClient,
      contentBlock.audio_url,
      contentBlock.id
    )

    if (!storageResult.success) {
      // Log the error but continue with database update
      await safeLog(supabaseClient, {
        event_type: 'expiration_cleanup',
        status: 'error',
        message: `Failed to delete audio from storage: ${storageResult.error}`,
        content_block_id: contentBlock.id,
        metadata: { audio_url: contentBlock.audio_url }
      })
    }

    // Update database record regardless of storage deletion result
    const dbResult = await updateContentBlockAfterCleanup(
      supabaseClient,
      contentBlock.id
    )

    if (!dbResult.success) {
      return { 
        success: false, 
        audioDeleted: storageResult.success,
        error: dbResult.error 
      }
    }

    // Log successful cleanup
    await safeLog(supabaseClient, {
      event_type: 'expiration_cleanup',
      status: 'success',
      message: `Cleaned up expired content block`,
      content_block_id: contentBlock.id,
      metadata: { 
        audio_deleted: storageResult.success,
        expiration_date: contentBlock.expiration_date,
        content_type: contentBlock.content_type
      }
    })

    return { 
      success: true, 
      audioDeleted: storageResult.success 
    }

  } catch (error) {
    return { 
      success: false, 
      audioDeleted: false,
      error: `Unexpected error processing content block ${contentBlock.id}: ${error.message}` 
    }
  }
}

// Main function to process expired content blocks in batches
async function processExpiredContentBlocks(supabaseClient: any): Promise<CleanupResult> {
  const result: CleanupResult = {
    success: true,
    processedCount: 0,
    deletedAudioCount: 0,
    errors: []
  }

  try {
    let offset = 0
    let hasMore = true

    while (hasMore) {
      // Query for expired content blocks with audio URLs
      const { data: contentBlocks, error: queryError } = await supabaseClient
        .from('content_blocks')
        .select('*')
        .lt('expiration_date', new Date().toISOString().split('T')[0]) // Less than today
        .not('audio_url', 'is', null) // Has audio URL
        .neq('status', 'expired') // Not already marked as expired
        .order('expiration_date', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (queryError) {
        result.errors.push(`Query error: ${queryError.message}`)
        result.success = false
        break
      }

      if (!contentBlocks || contentBlocks.length === 0) {
        hasMore = false
        break
      }

      // Process each content block in the batch
      for (const contentBlock of contentBlocks) {
        const processResult = await processExpiredContentBlock(supabaseClient, contentBlock)
        
        result.processedCount++
        
        if (processResult.audioDeleted) {
          result.deletedAudioCount++
        }
        
        if (!processResult.success) {
          result.errors.push(processResult.error || 'Unknown error')
          result.success = false
        }
      }

      offset += BATCH_SIZE
      hasMore = contentBlocks.length === BATCH_SIZE
    }

    // Log summary
    await safeLog(supabaseClient, {
      event_type: 'expiration_cleanup',
      status: result.success ? 'success' : 'partial_success',
      message: `Expiration cleanup completed: ${result.processedCount} processed, ${result.deletedAudioCount} audio files deleted`,
      metadata: {
        processed_count: result.processedCount,
        deleted_audio_count: result.deletedAudioCount,
        error_count: result.errors.length
      }
    })

  } catch (error) {
    result.success = false
    result.errors.push(`Unexpected error in batch processing: ${error.message}`)
    
    await safeLog(supabaseClient, {
      event_type: 'expiration_cleanup',
      status: 'error',
      message: `Batch processing failed: ${error.message}`,
      metadata: { error: error.message }
    })
  }

  return result
}

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Process expired content blocks
    const result = await processExpiredContentBlocks(supabaseClient)

    return new Response(
      JSON.stringify({
        success: result.success,
        processed_count: result.processedCount,
        deleted_audio_count: result.deletedAudioCount,
        errors: result.errors,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 500
      }
    )

  } catch (error) {
    console.error('Expiration cleanup function error:', error)
    
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