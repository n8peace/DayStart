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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get UTC date for sports content
    const utcDate = new Date().toISOString().split('T')[0]

    // Get expiration date (72 hours from now) in UTC
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Get today's date for sports data lookup

    // Fetch sports data from SportsDB API for today's events
    let sportsDbData = null
    let sportsDbError = null
    try {
      const sportsDbApiKey = Deno.env.get('SPORTSDB_API_KEY') || '123' // Use free key if not configured
              const sportsDbResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/${sportsDbApiKey}/eventsday.php?d=${utcDate}`)
      if (sportsDbResponse.ok) {
        sportsDbData = await sportsDbResponse.json()
      } else {
        sportsDbError = `SportsDB API failed: ${sportsDbResponse.status}`
      }
    } catch (error) {
      sportsDbError = `SportsDB API error: ${error.message}`
    }

    // Fetch sports data from ESPN API
    let espnData = null
    let espnError = null
    try {
      const espnResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')
      if (espnResponse.ok) {
        espnData = await espnResponse.json()
      } else {
        espnError = `ESPN API failed: ${espnResponse.status}`
      }
    } catch (error) {
      espnError = `ESPN API error: ${error.message}`
    }

    // Log API calls
    await supabaseClient
      .from('logs')
      .insert([
        {
          event_type: 'api_call',
          status: sportsDbError ? 'error' : 'success',
          message: sportsDbError || 'SportsDB API data fetched successfully',
          metadata: { api: 'sportsdb_api' }
        },
        {
          event_type: 'api_call',
          status: espnError ? 'error' : 'success',
          message: espnError || 'ESPN API data fetched successfully',
          metadata: { api: 'espn_api' }
        }
      ])

    // Create content summary
    let content = 'Sports Update: '
    const sportsEvents = []

    if (sportsDbData?.events) {
      sportsDbData.events.slice(0, 3).forEach((event: any) => {
        sportsEvents.push(`${event.strEvent} on ${event.dateEvent}`)
      })
    }

    if (espnData?.events) {
      espnData.events.slice(0, 2).forEach((event: any) => {
        const homeTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.name
        const awayTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.name
        const date = event.date
        if (homeTeam && awayTeam) {
          sportsEvents.push(`${awayTeam} vs ${homeTeam} on ${date}`)
        }
      })
    }

    if (sportsEvents.length > 0) {
      content += sportsEvents.join('. ')
    } else {
      content += 'No sports events available'
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'sports',
      date: utcDate,
      content: content,
      parameters: {
        sportsdb_data: sportsDbData,
        espn_data: espnData,
        sportsdb_error: sportsDbError,
        espn_error: espnError,
        sports_events: sportsEvents
      },
      status: (sportsDbError && espnError) ? 'content_failed' : 'content_ready',
      content_priority: 4,
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

    // Log successful content generation
    await supabaseClient
      .from('logs')
      .insert({
        event_type: 'content_generated',
        status: 'success',
        message: 'Sports content generated successfully',
        content_block_id: data.id,
        metadata: { content_type: 'sports', date: utcDate }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        sportsdb_error: sportsDbError,
        espn_error: espnError
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating sports content:', error)

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
          message: `Sports content generation failed: ${error.message}`,
          metadata: { content_type: 'sports', error: error.toString() }
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