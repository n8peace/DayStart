import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

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
        function: 'generate-sports-content',
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
          function: 'generate-sports-content',
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

    const utcDateStr = utcDate()
    const expirationDate = new Date(utcDateStr)
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Fetch US sports data from multiple ESPN APIs
    const usSports = [
      { sport: 'football', league: 'nfl', name: 'NFL' },
      { sport: 'basketball', league: 'nba', name: 'NBA' },
      { sport: 'baseball', league: 'mlb', name: 'MLB' },
      { sport: 'hockey', league: 'nhl', name: 'NHL' }
    ]

    const sportsData = {}
    const sportsErrors = {}
    let executionStatus = 'completed'
    let apiCallCount = 0

    // Fetch data for each major US sport
    for (const sport of usSports) {
      try {
        apiCallCount++
        console.log(`Making ESPN API call ${apiCallCount}/6 for ${sport.name}`)
        
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport.sport}/${sport.league}/scoreboard`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (response.ok) {
          sportsData[sport.name] = await response.json()
          console.log(`Successfully fetched ${sport.name} data`)
        } else {
          sportsErrors[sport.name] = `ESPN ${sport.name} API failed: ${response.status}`
          console.error(`ESPN ${sport.name} API failed:`, response.status)
        }
      } catch (error) {
        sportsErrors[sport.name] = `ESPN ${sport.name} API error: ${error.message}`
        console.error(`ESPN ${sport.name} API error:`, error)
      }
    }

    // Fetch NCAA Football and Basketball data
    try {
      apiCallCount++
      console.log(`Making ESPN API call ${apiCallCount}/6 for NCAA Football`)
      
      const ncaaFootballResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard', {
        signal: AbortSignal.timeout(10000)
      })
      
      if (ncaaFootballResponse.ok) {
        sportsData['NCAA Football'] = await ncaaFootballResponse.json()
        console.log('Successfully fetched NCAA Football data')
      } else {
        sportsErrors['NCAA Football'] = `ESPN NCAA Football API failed: ${ncaaFootballResponse.status}`
        console.error('ESPN NCAA Football API failed:', ncaaFootballResponse.status)
      }
    } catch (error) {
      sportsErrors['NCAA Football'] = `ESPN NCAA Football API error: ${error.message}`
      console.error('ESPN NCAA Football API error:', error)
    }

    try {
      apiCallCount++
      console.log(`Making ESPN API call ${apiCallCount}/6 for NCAA Basketball`)
      
      const ncaaBasketballResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard', {
        signal: AbortSignal.timeout(10000)
      })
      
      if (ncaaBasketballResponse.ok) {
        sportsData['NCAA Basketball'] = await ncaaBasketballResponse.json()
        console.log('Successfully fetched NCAA Basketball data')
      } else {
        sportsErrors['NCAA Basketball'] = `ESPN NCAA Basketball API failed: ${ncaaBasketballResponse.status}`
        console.error('ESPN NCAA Basketball API failed:', ncaaBasketballResponse.status)
      }
    } catch (error) {
      sportsErrors['NCAA Basketball'] = `ESPN NCAA Basketball API error: ${error.message}`
      console.error('ESPN NCAA Basketball API error:', error)
    }

    // Determine execution status based on API results
    const totalApis = Object.keys(sportsData).length + Object.keys(sportsErrors).length
    const errorCount = Object.keys(sportsErrors).length
    
    if (errorCount === totalApis) {
      executionStatus = 'completed_with_errors'
    } else if (errorCount > 0) {
      executionStatus = 'completed_with_warnings'
    }

    // Log API calls
    const logEntries = []
    for (const [sport, error] of Object.entries(sportsErrors)) {
      logEntries.push({
        event_type: 'api_call',
        status: 'error',
        message: error,
        metadata: { 
          api: `espn_${sport.toLowerCase().replace(' ', '_')}`,
          execution_status: executionStatus
        }
      })
    }
    
    // Add success logs for sports with data
    for (const sport of Object.keys(sportsData)) {
      logEntries.push({
        event_type: 'api_call',
        status: 'success',
        message: `${sport} data fetched successfully`,
        metadata: { 
          api: `espn_${sport.toLowerCase().replace(' ', '_')}`,
          execution_status: executionStatus
        }
      })
    }

    if (logEntries.length > 0) {
      try {
        await supabaseClient
          .from('logs')
          .insert(logEntries)
      } catch (logError) {
        console.error('Failed to log API calls:', logError)
      }
    }

    // Create US-centric sports content summary
    let content = 'US Sports Update: '
    const sportsEvents = []

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
    } else if (Object.keys(sportsErrors).length > 0) {
      content += 'Sports information temporarily unavailable due to API issues. Please check back later.'
    } else {
      content += 'No major US sports events today'
    }

    // Determine content block status
    let finalStatus = ContentBlockStatus.CONTENT_READY
    if (Object.keys(sportsErrors).length === totalApis && Object.keys(sportsData).length === 0) {
      finalStatus = ContentBlockStatus.CONTENT_FAILED
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'sports',
      date: utcDateStr,
      content: content,
      parameters: {
        sports_data: sportsData, // Keep full data for now as requested
        sports_errors: sportsErrors,
        sports_events: sportsEvents,
        us_sports_focus: true,
        execution_status: executionStatus,
        api_call_count: apiCallCount,
        successful_apis: Object.keys(sportsData).length,
        failed_apis: Object.keys(sportsErrors).length,
        data_size_bytes: JSON.stringify(sportsData).length
      },
      status: finalStatus,
      content_priority: 4,
      expiration_date: expirationDateStr,
      language_code: 'en-US'
    }

    // Check data size and warn if too large
    const dataSize = JSON.stringify(sportsData).length
    if (dataSize > 1000000) { // 1MB warning threshold
      console.warn(`Large sports data detected: ${(dataSize / 1024 / 1024).toFixed(2)}MB`)
    }

    const { data, error } = await supabaseClient
      .from('content_blocks')
      .insert(contentBlock)
      .select()
      .single()

    if (error) {
      throw error
    }
    validateObjectShape(data, ['id', 'content_type', 'date', 'status'])

    // Log successful content generation
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generated',
          status: 'success',
          message: 'Sports content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'sports', 
            date: utcDateStr,
            execution_status: executionStatus,
            data_size_bytes: dataSize
          }
        })
    } catch (logError) {
      console.error('Failed to log successful generation:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: {
          id: data.id,
          content_type: data.content_type,
          date: data.date,
          status: data.status,
          content: data.content
        },
        execution_status: executionStatus,
        sports_errors: sportsErrors,
        sports_data_summary: Object.keys(sportsData),
        api_call_count: apiCallCount,
        // Removed sports_data from response to prevent "output too large" error
        // Full data is still stored in database parameters
        data_size_bytes: dataSize
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
          metadata: { 
            content_type: 'sports', 
            error: error.toString(),
            errorType: error.name,
            stack: error.stack
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
        content_type: 'sports'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 