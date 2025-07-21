// Last Updated: 2024-07-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

// Enhanced interfaces for sports data processing
interface SportsEvent {
  sport: string
  league: string
  homeTeam: string
  awayTeam: string
  homeScore?: string
  awayScore?: string
  status: string
  date: string
  time?: string
  location?: string
  venue?: string
  importance: number
  rawData: any
}

interface ProcessedSportsArticle {
  title: string
  description: string
  source: string
  url: string
  publishedAt: string
  category: string
  content: string
  rawData: any
}

interface ScoredSportsArticle {
  article: ProcessedSportsArticle
  score: number
  factors: {
    sourceReliability: number
    recency: number
    sportsRelevance: number
    impact: number
    contentQuality: number
  }
}

interface SportsTrend {
  overallActivity: 'high' | 'medium' | 'low'
  keyEvents: string[]
  summary: string
}

// Calculate sports event importance score
function calculateSportsEventImportance(event: SportsEvent): number {
  let importance = 0.5 // Base score
  
  // Sport importance weighting
  const sportWeights: Record<string, number> = {
    'NFL': 1.0,
    'NBA': 0.9,
    'MLB': 0.8,
    'NHL': 0.7,
    'NCAA Football': 0.8,
    'NCAA Basketball': 0.7
  }
  
  importance += sportWeights[event.league] || 0.5
  
  // Status importance (live/final games are more important)
  if (event.status === 'STATUS_LIVE' || event.status === 'STATUS_FINAL') {
    importance += 0.2
  }
  
  // Close game bonus
  if (event.homeScore && event.awayScore) {
    const homeScore = parseInt(event.homeScore)
    const awayScore = parseInt(event.awayScore)
    const scoreDiff = Math.abs(homeScore - awayScore)
    if (scoreDiff <= 3) importance += 0.1 // Close game
  }
  
  return Math.max(0, Math.min(1, importance))
}

// Extract sports category from title and description
function extractSportsCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  
  if (text.includes('football') || text.includes('nfl') || text.includes('college football')) return 'football'
  if (text.includes('basketball') || text.includes('nba') || text.includes('college basketball')) return 'basketball'
  if (text.includes('baseball') || text.includes('mlb')) return 'baseball'
  if (text.includes('hockey') || text.includes('nhl')) return 'hockey'
  if (text.includes('soccer') || text.includes('fifa')) return 'soccer'
  if (text.includes('tennis')) return 'tennis'
  if (text.includes('golf')) return 'golf'
  
  return 'general'
}

// Get sports source reliability score
function getSportsSourceReliabilityScore(sourceName: string): number {
  const reliabilityScores: Record<string, number> = {
    // Major sports networks
    'ESPN': 0.95,
    'Sports Illustrated': 0.9,
    'The Athletic': 0.9,
    'Bleacher Report': 0.85,
    'CBS Sports': 0.9,
    'NBC Sports': 0.9,
    'Fox Sports': 0.85,
    'Yahoo Sports': 0.85,
    
    // Major news outlets with good sports coverage
    'Associated Press': 0.9,
    'The New York Times': 0.85,
    'USA Today': 0.8,
    'CNN': 0.75,
    'ABC News': 0.75,
    'CBS News': 0.75,
    'NBC News': 0.75,
    
    // Team-specific and local sources
    'NFL.com': 0.9,
    'NBA.com': 0.9,
    'MLB.com': 0.9,
    'NHL.com': 0.9,
    
    // Lower reliability
    'TMZ Sports': 0.4,
    'Deadspin': 0.6,
    'Barstool Sports': 0.5
  }
  
  return reliabilityScores[sourceName] || 0.6
}

// Sports relevance scoring for news articles
function calculateSportsRelevance(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase()
  let relevance = 0.5 // Base score
  
  // High sports relevance keywords
  const highRelevance = [
    'game', 'match', 'playoff', 'championship', 'super bowl', 'world series',
    'nba finals', 'stanley cup', 'player', 'coach', 'team', 'draft', 'trade',
    'injury', 'contract', 'extension', 'retirement', 'comeback', 'record'
  ]
  
  // Medium relevance keywords
  const mediumRelevance = [
    'sport', 'athlete', 'league', 'season', 'win', 'loss', 'victory',
    'defeat', 'score', 'points', 'goals', 'runs', 'touchdown'
  ]
  
  highRelevance.forEach(term => {
    if (text.includes(term)) relevance += 0.1
  })
  
  mediumRelevance.forEach(term => {
    if (text.includes(term)) relevance += 0.05
  })
  
  return Math.max(0, Math.min(1, relevance))
}

// Calculate sports article importance score
function calculateSportsArticleScore(article: ProcessedSportsArticle): ScoredSportsArticle {
  const factors = {
    sourceReliability: getSportsSourceReliabilityScore(article.source),
    recency: calculateRecencyScore(article.publishedAt),
    sportsRelevance: calculateSportsRelevance(article.title, article.description),
    impact: calculateImpactScore(article.title, article.description),
    contentQuality: calculateContentQuality(article.description, article.content)
  }
  
  // Weighted average with emphasis on sports relevance
  const score = (
    factors.sourceReliability * 0.15 +
    factors.recency * 0.15 +
    factors.sportsRelevance * 0.35 +
    factors.impact * 0.2 +
    factors.contentQuality * 0.15
  )
  
  return { article, score, factors }
}

// Sports trend analysis
function analyzeSportsTrends(sportsEvents: SportsEvent[]): SportsTrend {
  const totalEvents = sportsEvents.length
  const liveEvents = sportsEvents.filter(e => e.status === 'STATUS_LIVE').length
  const finalEvents = sportsEvents.filter(e => e.status === 'STATUS_FINAL').length
  
  let overallActivity: 'high' | 'medium' | 'low' = 'low'
  if (totalEvents > 10) overallActivity = 'high'
  else if (totalEvents > 5) overallActivity = 'medium'
  
  const keyEvents: string[] = []
  
  // Add significant events
  sportsEvents
    .filter(e => e.importance > 0.7)
    .slice(0, 3)
    .forEach(event => {
      if (event.status === 'STATUS_FINAL' && event.homeScore && event.awayScore) {
        keyEvents.push(`${event.awayTeam} ${event.awayScore} - ${event.homeTeam} ${event.homeScore} (${event.league})`)
      } else if (event.status === 'STATUS_LIVE') {
        keyEvents.push(`${event.awayTeam} at ${event.homeTeam} - LIVE (${event.league})`)
      } else {
        keyEvents.push(`${event.awayTeam} at ${event.homeTeam} (${event.league})`)
      }
    })
  
  const summary = `Sports activity: ${overallActivity}. ${liveEvents} live games, ${finalEvents} completed.`
  
  return {
    overallActivity,
    keyEvents,
    summary
  }
}

// Utility functions (reused from headlines and markets)
function calculateRecencyScore(publishedAt: string): number {
  if (!publishedAt) return 0.5
  
  const published = new Date(publishedAt)
  const now = new Date()
  const hoursDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60)
  
  if (hoursDiff <= 1) return 1.0
  if (hoursDiff <= 6) return 0.9
  if (hoursDiff <= 12) return 0.8
  if (hoursDiff <= 24) return 0.7
  if (hoursDiff <= 48) return 0.5
  return 0.3
}

function calculateImpactScore(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase()
  let impactScore = 0.5
  
  const highImpact = [
    'breaking', 'urgent', 'crisis', 'emergency', 'announcement', 'decision',
    'injury', 'trade', 'draft', 'contract', 'retirement', 'comeback',
    'championship', 'playoff', 'super bowl', 'world series', 'nba finals'
  ]
  
  const mediumImpact = [
    'report', 'study', 'analysis', 'survey', 'announce', 'launch',
    'increase', 'decrease', 'change', 'update', 'reveal'
  ]
  
  highImpact.forEach(term => {
    if (text.includes(term)) impactScore += 0.1
  })
  
  mediumImpact.forEach(term => {
    if (text.includes(term)) impactScore += 0.05
  })
  
  return Math.max(0, Math.min(1, impactScore))
}

function calculateContentQuality(description: string, content: string): number {
  const text = `${description} ${content}`.toLowerCase()
  let qualityScore = 0.5
  
  if (text.length > 100) qualityScore += 0.1
  if (text.length > 200) qualityScore += 0.1
  
  if (text.includes('according to') || text.includes('said') || text.includes('reported')) {
    qualityScore += 0.1
  }
  
  if (text.includes('percent') || text.includes('%') || text.includes('million') || text.includes('billion')) {
    qualityScore += 0.1
  }
  
  return Math.max(0, Math.min(1, qualityScore))
}

// Format date for display
function formatEventDate(dateString: string): string {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow'
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    })
  }
}

// Format time for display
function formatEventTime(timeString: string): string {
  if (!timeString) return ''
  
  const time = new Date(timeString)
  return time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
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

    // Enhanced sports data processing with dates and locations
    const processedSportsEvents: SportsEvent[] = []
    
    // Process each sport's data
    for (const [sportName, sportData] of Object.entries(sportsData)) {
      if (sportData?.events) {
        // Get today's games
        const todayGames = sportData.events.slice(0, 5) // Increased to 5 for better coverage
        
        todayGames.forEach((event: any) => {
          const homeTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.name
          const awayTeam = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.name
          const homeScore = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.score
          const awayScore = event.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.score
          const status = event.status?.type?.name
          const date = event.date
          const time = event.date
          const venue = event.competitions?.[0]?.venue?.fullName
          const location = event.competitions?.[0]?.venue?.address?.city
          
          if (homeTeam && awayTeam) {
            const sportsEvent: SportsEvent = {
              sport: sportName,
              league: sportName,
              homeTeam,
              awayTeam,
              homeScore,
              awayScore,
              status: status || 'STATUS_SCHEDULED',
              date: date || '',
              time,
              location,
              venue,
              importance: 0, // Will be calculated below
              rawData: event
            }
            
            // Calculate importance score
            sportsEvent.importance = calculateSportsEventImportance(sportsEvent)
            processedSportsEvents.push(sportsEvent)
          }
        })
      }
    }

    // Sort events by importance and status
    processedSportsEvents.sort((a, b) => {
      // Live games first
      if (a.status === 'STATUS_LIVE' && b.status !== 'STATUS_LIVE') return -1
      if (b.status === 'STATUS_LIVE' && a.status !== 'STATUS_LIVE') return 1
      
      // Then by importance
      return b.importance - a.importance
    })

    // Fetch sports news from News API
    let sportsNews: any = null
    let newsError: string | null = null
    
    try {
      const newsApiKey = Deno.env.get('NEWS_API_KEY')
      if (newsApiKey) {
        apiCallCount++
        console.log('Making News API call for sports headlines')
        
        const response = await fetch(`https://newsapi.org/v2/top-headlines?category=sports&country=us&apiKey=${newsApiKey}&pageSize=5`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (response.ok) {
          const rawSportsNews = await response.json()
          
          // Enhanced sports news processing
          if (rawSportsNews.articles && rawSportsNews.articles.length > 0) {
            const processedArticles: ProcessedSportsArticle[] = []
            
            rawSportsNews.articles.slice(0, 8).forEach((article: any) => {
              const processed: ProcessedSportsArticle = {
                title: article.title || '',
                description: article.description || article.content || '',
                source: article.source?.name || 'Unknown',
                url: article.url || '',
                publishedAt: article.publishedAt || '',
                category: extractSportsCategory(article.title || '', article.description || ''),
                content: article.content || '',
                rawData: article
              }
              processedArticles.push(processed)
            })
            
            // Score and sort articles
            const scoredArticles: ScoredSportsArticle[] = processedArticles.map(calculateSportsArticleScore)
            scoredArticles.sort((a, b) => b.score - a.score)
            
            sportsNews = {
              articles: scoredArticles.slice(0, 3), // Top 3 articles
              totalArticles: processedArticles.length,
              topCategories: [...new Set(processedArticles.map(a => a.category))]
            }
            
            console.log('Successfully processed sports news with scoring')
          } else {
            newsError = 'No sports articles available from News API'
          }
        } else {
          newsError = `News API failed: ${response.status}`
          console.error('News API failed:', response.status)
        }
      } else {
        newsError = 'News API key not configured - skipping sports news'
        console.warn('NEWS_API_KEY not configured, skipping sports news')
        
        // Log the missing News API key configuration
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'api_call',
              status: 'warning',
              message: 'News API key not configured - skipping sports news',
              metadata: { 
                api: 'news_api_sports',
                error: 'API key not configured',
                has_fallback: true,
                timestamp: new Date().toISOString()
              }
            })
        } catch (logError) {
          console.error('Failed to log missing API key:', logError)
        }
      }
    } catch (error) {
      newsError = `Sports news API error: ${error.message}`
      console.error('Sports news API error:', error)
    }

    // Analyze sports trends
    const sportsTrends = analyzeSportsTrends(processedSportsEvents)

    // Create enhanced sports content with dates, locations, and news
    let content = 'US Sports Update: '
    const sportsEvents = []

    // Format sports events with dates and locations
    processedSportsEvents.slice(0, 8).forEach((event) => {
      const dateStr = formatEventDate(event.date)
      const timeStr = formatEventTime(event.time)
      const locationStr = event.location ? ` in ${event.location}` : ''
      
      if (event.status === 'STATUS_FINAL' && event.homeScore && event.awayScore) {
        sportsEvents.push(`${event.league}: ${event.awayTeam} ${event.awayScore} - ${event.homeTeam} ${event.homeScore}${locationStr}`)
      } else if (event.status === 'STATUS_LIVE') {
        sportsEvents.push(`${event.league}: ${event.awayTeam} at ${event.homeTeam} - LIVE${locationStr}`)
      } else {
        const timeInfo = timeStr ? ` at ${timeStr}` : ''
        const dateInfo = dateStr ? ` (${dateStr})` : ''
        sportsEvents.push(`${event.league}: ${event.awayTeam} at ${event.homeTeam}${timeInfo}${dateInfo}${locationStr}`)
      }
    })

    if (sportsEvents.length > 0) {
      content += sportsEvents.join('. ')
    } else if (Object.keys(sportsErrors).length > 0) {
      content += 'Sports information temporarily unavailable due to API issues. Please check back later.'
    } else {
      content += 'No major US sports events today'
    }

    // Add sports news context if available
    if (sportsNews && sportsNews.articles && sportsNews.articles.length > 0) {
      content += ' In sports news: '
      const headlines = sportsNews.articles.map((scoredArticle: ScoredSportsArticle) => {
        return scoredArticle.article.title.split(' - ')[0] // Remove source from title
      })
      content += headlines.join('. ')
    } else if (newsError && newsError.includes('not configured')) {
      content += ' Sports news unavailable - API not configured.'
    } else if (newsError) {
      content += ' Sports news temporarily unavailable.'
    }

    // Determine content block status
    let finalStatus = ContentBlockStatus.CONTENT_READY
    if (Object.keys(sportsErrors).length === totalApis && Object.keys(sportsData).length === 0) {
      finalStatus = ContentBlockStatus.CONTENT_FAILED
    }

    // Create enhanced content block with rich parameters
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'sports',
      date: utcDateStr,
      content: content,
      parameters: {
        sports_data: sportsData,
        sports_errors: sportsErrors,
        sports_events: sportsEvents,
        processed_sports_events: processedSportsEvents,
        sports_trends: sportsTrends,
        sports_news: sportsNews,
        news_error: newsError,
        us_sports_focus: true,
        execution_status: executionStatus,
        api_call_count: apiCallCount,
        successful_apis: Object.keys(sportsData).length,
        failed_apis: Object.keys(sportsErrors).length,
        data_size_bytes: JSON.stringify(sportsData).length,
        processing_version: '2.0-enhanced',
        enhanced_features: {
          dates_included: true,
          locations_included: true,
          sports_news_integrated: !!sportsNews,
          importance_scoring: true,
          trend_analysis: true
        }
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
          message: 'Enhanced sports content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'sports', 
            date: utcDateStr,
            execution_status: executionStatus,
            data_size_bytes: dataSize,
            processing_version: '2.0-enhanced',
            sports_events_count: processedSportsEvents.length,
            sports_news_included: !!sportsNews,
            sports_trends_analyzed: !!sportsTrends
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
        processing_version: '2.0-enhanced',
        enhanced_features: {
          dates_included: true,
          locations_included: true,
          sports_news_integrated: !!sportsNews,
          importance_scoring: true,
          trend_analysis: true
        },
        sports_events_count: processedSportsEvents.length,
        sports_news_count: sportsNews?.articles?.length || 0,
        sports_trends: sportsTrends,
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
