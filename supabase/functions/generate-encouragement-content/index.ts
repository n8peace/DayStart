import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ContentBlock {
  id: string
  content_type: string
  date: string
  content?: string
  parameters?: any
  status: string
  content_priority: number
  expiration_date: string
  language_code: string
  created_at: string
  updated_at: string
}

const ENCOURAGEMENT_TYPES = ['Christian', 'Stoic', 'Muslim', 'Jewish', 'General']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get UTC dates for content generation
    const utcDate = new Date().toISOString().split('T')[0]
    const tomorrowUtc = new Date()
    tomorrowUtc.setDate(tomorrowUtc.getDate() + 1)
    const tomorrowDate = tomorrowUtc.toISOString().split('T')[0]

    // Get expiration date (72 hours from now) in UTC
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    const results = []

    // Generate content for each encouragement type
    for (const encouragementType of ENCOURAGEMENT_TYPES) {
      try {
        // Get previous 5 encouragements of this type to avoid repetition
        const { data: previousEncouragements, error: previousError } = await supabaseClient
          .from('content_blocks')
          .select('content')
          .eq('content_type', 'encouragement')
          .in('status', ['ready', 'content_ready'])
          .not('status', 'content_failed')
          .contains('parameters', { encouragement_type: encouragementType })
          .order('created_at', { ascending: false })
          .limit(5)

        if (previousError) {
          console.error(`Error fetching previous ${encouragementType} encouragements:`, previousError)
        }

        const previousMessages = previousEncouragements?.map(e => e.content) || []

        // Create content summary
        const content = `Type: ${encouragementType}. Previous messages: ${previousMessages.join(' | ')}`

        // Create content block
        const contentBlock: Partial<ContentBlock> = {
          content_type: 'encouragement',
          date: tomorrowDate,
          content: content,
          parameters: {
            encouragement_type: encouragementType,
            previous_messages: previousMessages
          },
          status: 'content_ready',
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

        results.push(data)

        // Log successful content generation
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'content_generated',
            status: 'success',
            message: `${encouragementType} encouragement content generated successfully`,
            content_block_id: data.id,
            metadata: { 
              content_type: 'encouragement', 
              encouragement_type: encouragementType,
              date: tomorrowDate 
            }
          })

      } catch (error) {
        console.error(`Error generating ${encouragementType} encouragement content:`, error)
        
        // Log individual encouragement processing error
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'content_generation_failed',
            status: 'error',
            message: `${encouragementType} encouragement content generation failed: ${error.message}`,
            metadata: { 
              content_type: 'encouragement', 
              encouragement_type: encouragementType,
              error: error.toString() 
            }
          })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_blocks: results,
        total_processed: ENCOURAGEMENT_TYPES.length,
        successful: results.length
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