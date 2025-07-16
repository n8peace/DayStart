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

    // Get expiration date (72 hours from target date) in UTC
    const expirationDate = new Date(utcDate)
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Get today's date for sports data lookup

    // Fetch US sports data from multiple ESPN APIs
    const usSports = [
      { sport: 'football', league: 'nfl', name: 'NFL' },
      { sport: 'basketball', league: 'nba', name: 'NBA' },
      { sport: 'baseball', league: 'mlb', name: 'MLB' },
      { sport: 'hockey', league: 'nhl', name: 'NHL' }
    ]

    const sportsData = {}
    const sportsErrors = {}

    // Fetch data for each major US sport
    for (const sport of usSports) {
      try {
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.sport}/${sport.league}/scoreboard`)
        if (response.ok) {
          sportsData[sport.name] = await response.json()
        } else {
          sportsErrors[sport.name] = `ESPN ${sport.name} API failed: ${response.status}`
        }
      } catch (error) {
        sportsErrors[sport.name] = `ESPN ${sport.name} API error: ${error.message}`
      }
    }

    // Fetch NCAA Football and Basketball data
    try {
      const ncaaFootballResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard')
      if (ncaaFootballResponse.ok) {
        sportsData['NCAA Football'] = await ncaaFootballResponse.json()
      } else {
        sportsErrors['NCAA Football'] = `ESPN NCAA Football API failed: ${ncaaFootballResponse.status}`
      }
    } catch (error) {
      sportsErrors['NCAA Football'] = `ESPN NCAA Football API error: ${error.message}`
    }

    try {
      const ncaaBasketballResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard')
      if (ncaaBasketballResponse.ok) {
        sportsData['NCAA Basketball'] = await ncaaBasketballResponse.json()
      } else {
        sportsErrors['NCAA Basketball'] = `ESPN NCAA Basketball API failed: ${ncaaBasketballResponse.status}`
      }
    } catch (error) {
      sportsErrors['NCAA Basketball'] = `ESPN NCAA Basketball API error: ${error.message}`
    }

    // Log API calls
    const logEntries = []
    for (const [sport, error] of Object.entries(sportsErrors)) {
      logEntries.push({
        event_type: 'api_call',
        status: 'error',
        message: error,
        metadata: { api: `espn_${sport.toLowerCase().replace(' ', '_')}` }
      })
    }
    
    // Add success logs for sports with data
    for (const sport of Object.keys(sportsData)) {
      logEntries.push({
        event_type: 'api_call',
        status: 'success',
        message: `${sport} data fetched successfully`,
        metadata: { api: `espn_${sport.toLowerCase().replace(' ', '_')}` }
      })
    }

    if (logEntries.length > 0) {
      await supabaseClient
        .from('logs')
        .insert(logEntries)
    }

    // Create US-centric sports content summary
    let content = 'US Sports Update: '
    const sportsEvents = []
    const sportsHighlights = []

    // Process each sport's data
    for (const [sportName, sportData] of Object.entries(sportsData)) {
      if (sportData?.events) {
        // Get today's games
        const todayGames = sportData.events.slice(0, 3)
        
        todayGames.forEach((event: any) => {
          const homeTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.name
          const awayTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.name
          const homeScore = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.score
          const awayScore = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.score
          const status = event.status?.type?.name
          
          if (homeTeam && awayTeam) {
            if (status === 'STATUS_FINAL' && homeScore && awayScore) {
              sportsEvents.push(`${sportName}: ${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}`)
            } else {
              sportsEvents.push(`${sportName}: ${awayTeam} at ${homeTeam}`)
            }
          }
        })
      }
    }

    if (sportsEvents.length > 0) {
      content += sportsEvents.join('. ')
    } else {
      content += 'No major US sports events today'
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'sports',
      date: utcDate,
      content: content,
      parameters: {
        sports_data: sportsData,
        sports_errors: sportsErrors,
        sports_events: sportsEvents,
        us_sports_focus: true
      },
      status: Object.keys(sportsErrors).length === Object.keys(sportsData).length ? 'content_failed' : 'content_ready',
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
        sports_errors: sportsErrors,
        sports_data_summary: Object.keys(sportsData)
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