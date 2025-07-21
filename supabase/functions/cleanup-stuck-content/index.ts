// Last Updated: 2024-07-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

interface CleanupResult {
  stuckBlocksFound: number
  blocksCleaned: number
  errors: string[]
  statusBreakdown: Record<string, number>
}

// Configuration
const STUCK_TIMEOUT_HOURS = 1 // 1 hour timeout
const BATCH_SIZE = 50 // Process in batches to avoid timeouts

// Helper function to map stuck status to failure status
function mapStuckStatusToFailureStatus(stuckStatus: string): string {
  switch (stuckStatus) {
    case 'script_generating':
      return 'script_failed'
    case 'audio_generating':
      return 'audio_failed'
    case 'content_generating':
      return 'content_failed'
    case 'retry_pending':
      return 'failed'
    default:
      return 'failed'
  }
}

// Helper function to get stuck status description
function getStuckStatusDescription(stuckStatus: string): string {
  switch (stuckStatus) {
    case 'script_generating':
      return 'GPT-4o script generation'
    case 'audio_generating':
      return 'ElevenLabs audio generation'
    case 'content_generating':
      return 'Content generation'
    case 'retry_pending':
      return 'Retry pending'
    default:
      return 'Unknown processing'
  }
}

async function cleanupStuckContentBlocks(
  supabaseClient: any
): Promise<CleanupResult> {
  const result: CleanupResult = {
    stuckBlocksFound: 0,
    blocksCleaned: 0,
    errors: [],
    statusBreakdown: {}
  }

  try {
    // Calculate the cutoff time (1 hour ago)
    const cutoffTime = utcDate(STUCK_TIMEOUT_HOURS * -1)

    // Find stuck content blocks
    const { data: stuckBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .in('status', ['script_generating', 'audio_generating', 'content_generating', 'retry_pending'])
      .lt('updated_at', cutoffTime)
      .order('updated_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      throw new Error(`Failed to fetch stuck content blocks: ${fetchError.message}`)
    }

    if (!stuckBlocks || stuckBlocks.length === 0) {
      console.log('No stuck content blocks found')
      
      // Log that no stuck blocks were found
      await safeLogError(supabaseClient, {
        event_type: 'cleanup_stuck_content_no_blocks',
        status: 'info',
        message: 'No stuck content blocks found during cleanup',
        metadata: {
          stuck_timeout_hours: STUCK_TIMEOUT_HOURS,
          cutoff_time: cutoffTime,
          batch_size: BATCH_SIZE
        }
      })
      
      return result
    }

    result.stuckBlocksFound = stuckBlocks.length
    console.log(`Found ${stuckBlocks.length} stuck content blocks`)

    // Group stuck blocks by status for processing
    const blocksByStatus = stuckBlocks.reduce((acc: Record<string, ContentBlock[]>, block: ContentBlock) => {
      if (!acc[block.status]) {
        acc[block.status] = []
      }
      acc[block.status].push(block)
      return acc
    }, {})

    // Process each status group
    for (const [stuckStatus, blocks] of Object.entries(blocksByStatus)) {
      const failureStatus = mapStuckStatusToFailureStatus(stuckStatus)
      const statusDescription = getStuckStatusDescription(stuckStatus)
      
      console.log(`Processing ${blocks.length} blocks stuck in ${stuckStatus} status`)

      // Update all blocks in this status group
      const blockIds = blocks.map(block => block.id)
      const { error: updateError } = await supabaseClient
        .from('content_blocks')
        .update({
          status: failureStatus,
          updated_at: new Date().toISOString(),
          retry_count: 0 // Reset retry count since we're giving up
        })
        .in('id', blockIds)
        .eq('status', stuckStatus) // Optimistic locking

      if (updateError) {
        const errorMsg = `Failed to update ${blocks.length} blocks from ${stuckStatus} to ${failureStatus}: ${updateError.message}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      } else {
        result.blocksCleaned += blocks.length
        result.statusBreakdown[stuckStatus] = blocks.length

        // Log successful cleanup for each block
        for (const block of blocks) {
          await safeLogError(supabaseClient, {
            event_type: 'cleanup_stuck_content_success',
            status: 'warning',
            message: `Cleaned up stuck content block: ${statusDescription} timed out after ${STUCK_TIMEOUT_HOURS} hour(s)`,
            content_block_id: block.id,
            metadata: {
              content_type: block.content_type,
              date: block.date,
              user_id: block.user_id,
              stuck_status: stuckStatus,
              failure_status: failureStatus,
              stuck_duration_hours: STUCK_TIMEOUT_HOURS,
              original_updated_at: block.updated_at,
              retry_count: block.retry_count
            }
          })
        }

        console.log(`Successfully cleaned up ${blocks.length} blocks from ${stuckStatus} status`)
      }
    }

    // Log overall cleanup summary
    await safeLogError(supabaseClient, {
      event_type: 'cleanup_stuck_content_summary',
      status: result.blocksCleaned > 0 ? 'warning' : 'info',
      message: `Stuck content cleanup completed: ${result.blocksCleaned}/${result.stuckBlocksFound} blocks cleaned`,
      metadata: {
        stuck_blocks_found: result.stuckBlocksFound,
        blocks_cleaned: result.blocksCleaned,
        error_count: result.errors.length,
        status_breakdown: result.statusBreakdown,
        stuck_timeout_hours: STUCK_TIMEOUT_HOURS,
        cutoff_time: cutoffTime,
        batch_size: BATCH_SIZE
      }
    })

  } catch (error) {
    console.error('Error in cleanupStuckContentBlocks:', error)
    result.errors.push(`Cleanup failed: ${error.message}`)

    // Log cleanup failure
    await safeLogError(supabaseClient, {
      event_type: 'cleanup_stuck_content_failed',
      status: 'error',
      message: `Stuck content cleanup failed: ${error.message}`,
      metadata: {
        error: error.toString(),
        errorType: error.name,
        stuck_timeout_hours: STUCK_TIMEOUT_HOURS,
        batch_size: BATCH_SIZE
      }
    })
  }

  return result
}

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
        function: 'cleanup-stuck-content',
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
          function: 'cleanup-stuck-content',
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

    const currentDate = utcDate()
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - 24) // 24 hours ago

    // Find content blocks that are stuck in processing states
    const { data: stuckBlocks, error: fetchError } = await supabaseClient
      .from('content_blocks')
      .select('*')
      .in('status', [ContentBlockStatus.CONTENT_GENERATING, ContentBlockStatus.SCRIPT_GENERATING, ContentBlockStatus.AUDIO_GENERATING])
      .lt('updated_at', cutoffDate.toISOString())
      .order('updated_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch stuck content blocks: ${fetchError.message}`)
    }

    if (!stuckBlocks || stuckBlocks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stuck content blocks found',
          cleaned_count: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200        }
      )
    }

    const cleanedBlocks = []
    const errors = []
    // Process each stuck block
    for (const block of stuckBlocks) {
      try {
        validateObjectShape(block, ['id', 'content_type', 'status', 'updated_at'])

        // Determine appropriate status based on current status
        let newStatus = ContentBlockStatus.FAILED
        if (block.status === ContentBlockStatus.CONTENT_GENERATING) {
          newStatus = ContentBlockStatus.CONTENT_FAILED
        } else if (block.status === ContentBlockStatus.SCRIPT_GENERATING) {
          newStatus = ContentBlockStatus.SCRIPT_FAILED
        } else if (block.status === ContentBlockStatus.AUDIO_GENERATING) {
          newStatus = ContentBlockStatus.AUDIO_FAILED
        }

        // Update the stuck block
        const { data: updatedBlock, error: updateError } = await supabaseClient
          .from('content_blocks')
          .update({
            status: newStatus,
            parameters: {
              ...block.parameters,
              stuck_cleanup: true,
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
              event_type: 'stuck_content_cleaned',
              status: 'success',
              message: `Stuck content block ${block.id} cleaned from ${block.status} to ${newStatus}`,
              content_block_id: block.id,
              metadata: {
                content_type: block.content_type,
                original_status: block.status,
                new_status: newStatus,
                stuck_duration_hours: Math.round((Date.now() - new Date(block.updated_at).getTime()) / (1000 * 60 * 60))
              }
            })
        } catch (logError) {
          safeLogError('Failed to log cleanup action:', logError)
        }

      } catch (error) {
        console.error(`Error cleaning stuck block ${block.id}:`, error)
        errors.push(`Block ${block.id}: ${error.message}`)

        // Log cleanup error
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'stuck_content_cleanup_failed',
              status: 'error',
              message: `Failed to clean stuck content block ${block.id}: ${error.message}`,
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
        total_found: stuckBlocks.length,
        successful: cleanedBlocks.length,
        errors: errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error cleaning stuck content:', error)

    // Log error
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'stuck_content_cleanup_failed',
          status: 'error',
          message: `Stuck content cleanup failed: ${error.message}`,
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