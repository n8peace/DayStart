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

interface CleanupResult {
  stuckBlocksFound: number
  blocksCleaned: number
  errors: string[]
  statusBreakdown: Record<string, number>
}

// Configuration
const STUCK_TIMEOUT_HOURS = 1 // 1 hour timeout
const BATCH_SIZE = 50 // Process in batches to avoid timeouts

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
    const cutoffTime = new Date(Date.now() - (STUCK_TIMEOUT_HOURS * 60 * 60 * 1000)).toISOString()

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Log cleanup start
    await safeLogError(supabaseClient, {
      event_type: 'cleanup_stuck_content_started',
      status: 'info',
      message: 'Starting stuck content cleanup process',
      metadata: {
        stuck_timeout_hours: STUCK_TIMEOUT_HOURS,
        batch_size: BATCH_SIZE,
        request_method: req.method
      }
    })

    // Perform cleanup
    const result = await cleanupStuckContentBlocks(supabaseClient)

    // Return response
    return new Response(
      JSON.stringify({
        success: result.errors.length === 0,
        stuck_blocks_found: result.stuckBlocksFound,
        blocks_cleaned: result.blocksCleaned,
        error_count: result.errors.length,
        errors: result.errors,
        status_breakdown: result.statusBreakdown,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.errors.length === 0 ? 200 : 207 // 207 Multi-Status for partial success
      }
    )

  } catch (error) {
    console.error('Error in cleanup-stuck-content function:', error)
    
    // Log error to database
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
        
        await safeLogError(supabaseClient, {
          event_type: 'cleanup_stuck_content_function_failed',
          status: 'error',
          message: `Cleanup function failed: ${error.message}`,
          metadata: { 
            error: error.toString(),
            errorType: error.name,
            stuck_timeout_hours: STUCK_TIMEOUT_HOURS,
            batch_size: BATCH_SIZE
          }
        })
      }
    } catch (logError) {
      console.error('Failed to log error to database:', logError)
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