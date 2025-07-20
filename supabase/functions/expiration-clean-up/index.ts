// Last Updated: 2024-07-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

interface CleanupResult {
  success: boolean
  processedCount: number
  deletedAudioCount: number
  errors: string[]
}

const BATCH_SIZE = 50 // Process in batches to avoid timeouts

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
      await safeLogError(supabaseClient, {
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
    await safeLogError(supabaseClient, {
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
        .lt('expiration_date', utcDate().split('T')[0]) // Less than today
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
    await safeLogError(supabaseClient, {
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
    
    await safeLogError(supabaseClient, {
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
  // Deployment trigger - Wed Jul 17 06:13:24 PDT 2025
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests
  const url = new URL(req.url)
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    try {
      const response = {
        status: 'healthy',
        function: 'expiration-clean-up',
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
          function: 'expiration-clean-up',
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const currentDate = utcDate()

    // Find expired content blocks
    const { data: expiredBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .lt('expiration_date', currentDate.split('T')[0])
      .neq('status', 'expired')
      .order('expiration_date', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch expired content blocks: ${fetchError.message}`)
    }

    if (!expiredBlocks || expiredBlocks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired content blocks found',
          cleaned_count: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const cleanedBlocks = []
    const errors = []
    // Process each expired block
    for (const block of expiredBlocks) {
      try {
        validateObjectShape(block, ['id', 'content_type', 'expiration_date', 'status'])

        // Update the expired block
        const { data: updatedBlock, error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            status: ContentBlockStatus.EXPIRED,
            parameters: {
              ...block.parameters,
              expired_cleanup: true,
              original_status: block.status,
              cleanup_timestamp: new Date().toISOString()
            }
          })
          .eq('id', block.id)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }
        validateObjectShape(updatedBlock, ['id', 'status'])

        cleanedBlocks.push(updatedBlock)

        // Log cleanup action
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'expired_content_cleaned',
              status: 'success',
              message: `Expired content block ${block.id} marked as expired`,
              content_block_id: block.id,
              metadata: {
                content_type: block.content_type,
                original_status: block.status,
                expiration_date: block.expiration_date,
                days_expired: Math.round((Date.now() - new Date(block.expiration_date).getTime()) / (10 * 60 * 60 * 24))
              }
            })
        } catch (logError) {
          safeLogError('Failed to log cleanup action:', logError)
        }

      } catch (error) {
        console.error(`Error cleaning expired block ${block.id}:`, error)
        errors.push(`Block ${block.id}: ${error.message}`)

        // Log cleanup error
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'expired_content_cleanup_failed',
              status: 'error',
              message: `Failed to clean expired content block ${block.id}: ${error.message}`,
              content_block_id: block.id,
              metadata: {
                content_type: block.content_type,
                error: error.toString() 
              }
            })
        } catch (logError) {
          safeLogError('Failed to log cleanup error:', logError)
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        cleaned_blocks: cleanedBlocks,
        total_found: expiredBlocks.length,
        successful: cleanedBlocks.length,
        errors: errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error cleaning expired content:', error)

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'expired_content_cleanup_failed',
          status: 'error',
          message: `Expired content cleanup failed: ${error.message}`,
          metadata: { error: error.toString() }
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
        status: 500      }
    )
  }
}) 