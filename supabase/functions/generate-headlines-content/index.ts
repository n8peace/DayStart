import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

// Enhanced data structures for better content processing
interface ProcessedArticle {
  title: string
  description: string
  summary: string
  source: string
  url: string
  publishedAt: string
  category: string
  content: string
  author: string
  rawData: any
}

interface ScoredArticle {
  article: ProcessedArticle
  score: number
  factors: {
    sourceReliability: number
    recency: number
    impact: number
    categoryWeight: number
    contentQuality: number
  }
}

// Category extraction function
function extractCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  
  const categories = {
    politics: ['biden', 'trump', 'congress', 'senate', 'house', 'election', 'vote', 'policy', 'government', 'administration', 'democrat', 'republican', 'campaign'],
    business: ['stock', 'market', 'economy', 'business', 'company', 'ceo', 'earnings', 'trade', 'finance', 'investment', 'corporate', 'merger', 'acquisition'],
    technology: ['tech', 'ai', 'artificial intelligence', 'software', 'app', 'digital', 'cyber', 'startup', 'innovation', 'algorithm', 'data', 'privacy'],
    health: ['health', 'medical', 'covid', 'vaccine', 'hospital', 'doctor', 'treatment', 'disease', 'patient', 'healthcare', 'medicine', 'clinical'],
    sports: ['game', 'team', 'player', 'league', 'championship', 'score', 'tournament', 'athlete', 'coach', 'season', 'playoff'],
    entertainment: ['movie', 'film', 'celebrity', 'music', 'award', 'show', 'actor', 'director', 'album', 'concert', 'performance'],
    science: ['research', 'study', 'scientific', 'discovery', 'space', 'climate', 'environment', 'experiment', 'laboratory', 'scientist'],
    world: ['international', 'foreign', 'global', 'country', 'diplomatic', 'embassy', 'treaty', 'alliance', 'conflict', 'peace']
  }
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category
    }
  }
  
  return 'general'
}

// Source reliability scoring
function getSourceReliabilityScore(sourceName: string): number {
  const reliabilityScores = {
    // High reliability (0.9-1.0)
    'Associated Press': 0.95,
    'Reuters': 0.95,
    'BBC News': 0.9,
    'NPR': 0.9,
    'The New York Times': 0.9,
    'The Washington Post': 0.9,
    'The Wall Street Journal': 0.9,
    'USA Today': 0.85,
    'Los Angeles Times': 0.85,
    'Chicago Tribune': 0.85,
    
    // Medium reliability (0.7-0.8)
    'CNN': 0.75,
    'Fox News': 0.75,
    'MSNBC': 0.75,
    'ABC News': 0.8,
    'CBS News': 0.8,
    'NBC News': 0.8,
    'PBS NewsHour': 0.8,
    'Time': 0.8,
    'Newsweek': 0.8,
    
    // Lower reliability (0.5-0.6)
    'Daily Mail': 0.5,
    'Breitbart': 0.5,
    'HuffPost': 0.6,
    'BuzzFeed': 0.5,
    'Vice': 0.6
  }
  
  return reliabilityScores[sourceName] || 0.6 // Default for unknown sources
}

// Category weighting
function getCategoryWeight(category: string): number {
  const weights = {
    politics: 0.9,    // High weight - affects everyone
    business: 0.8,    // High weight - economic impact
    health: 0.8,      // High weight - public health
    technology: 0.7,  // Medium-high - affects many
    science: 0.7,     // Medium-high - important discoveries
    world: 0.6,       // Medium - international impact
    sports: 0.4,      // Lower - entertainment value
    entertainment: 0.3, // Lowest - pure entertainment
    general: 0.5      // Default weight
  }
  
  return weights[category] || 0.5
}

// Impact score calculation
function calculateImpactScore(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase()
  let impactScore = 0.5 // Base score
  
  // High impact indicators
  const highImpact = [
    'breaking', 'urgent', 'crisis', 'emergency', 'disaster',
    'announcement', 'decision', 'approval', 'rejection',
    'election', 'vote', 'law', 'bill', 'policy', 'legislation',
    'ceo', 'president', 'leader', 'official', 'minister',
    'deadline', 'deadline', 'deadline', 'deadline', 'deadline'
  ]
  
  // Medium impact indicators  
  const mediumImpact = [
    'report', 'study', 'research', 'analysis', 'survey',
    'announce', 'launch', 'release', 'introduce', 'propose',
    'increase', 'decrease', 'change', 'update', 'reveal',
    'investigation', 'inquiry', 'review', 'audit'
  ]
  
  // Low impact indicators
  const lowImpact = [
    'rumor', 'speculation', 'might', 'could', 'may',
    'considering', 'thinking', 'planning', 'possibly',
    'allegedly', 'reportedly', 'sources say'
  ]
  
  highImpact.forEach(term => {
    if (text.includes(term)) impactScore += 0.1
  })
  
  mediumImpact.forEach(term => {
    if (text.includes(term)) impactScore += 0.05
  })
  
  lowImpact.forEach(term => {
    if (text.includes(term)) impactScore -= 0.05
  })
  
  return Math.max(0, Math.min(1, impactScore))
}

// Content quality calculation
function calculateContentQuality(description: string, content: string): number {
  const text = `${description} ${content}`.toLowerCase()
  let qualityScore = 0.5 // Base score
  
  // Quality indicators
  if (text.length > 100) qualityScore += 0.1 // Substantial content
  if (text.length > 200) qualityScore += 0.1 // Very substantial
  
  // Clarity indicators
  if (text.includes('according to') || text.includes('said') || text.includes('reported')) {
    qualityScore += 0.1 // Has attribution
  }
  
  if (text.includes('percent') || text.includes('%') || text.includes('million') || text.includes('billion')) {
    qualityScore += 0.1 // Has specific data
  }
  
  // Avoid clickbait
  if (text.includes('you won\'t believe') || text.includes('shocking') || text.includes('amazing')) {
    qualityScore -= 0.2
  }
  
  return Math.max(0, Math.min(1, qualityScore))
}

// Recency scoring
function calculateRecencyScore(publishedAt: string): number {
  if (!publishedAt) return 0.5
  
  const published = new Date(publishedAt)
  const now = new Date()
  const hoursDiff = (now.getTime() - published.getTime()) / (1000 * 60 * 60)
  
  if (hoursDiff <= 1) return 1.0      // Very recent
  if (hoursDiff <= 6) return 0.9      // Recent
  if (hoursDiff <= 12) return 0.8     // Today
  if (hoursDiff <= 24) return 0.7     // Yesterday
  if (hoursDiff <= 48) return 0.5     // 2 days ago
  return 0.3                          // Older
}

// Calculate importance score
function calculateImportanceScore(article: ProcessedArticle): ScoredArticle {
  const factors = {
    // Source reliability (0-1)
    sourceReliability: getSourceReliabilityScore(article.source),
    
    // Recency (0-1) - newer = higher score
    recency: calculateRecencyScore(article.publishedAt),
    
    // Impact indicators (0-1)
    impact: calculateImpactScore(article.title, article.description),
    
    // Category weight (0-1) - politics/business get higher weight
    categoryWeight: getCategoryWeight(article.category),
    
    // Content quality (0-1) - based on description length, clarity
    contentQuality: calculateContentQuality(article.description, article.content)
  }
  
  // Weighted average
  const score = (
    factors.sourceReliability * 0.2 +
    factors.recency * 0.15 +
    factors.impact * 0.3 +
    factors.categoryWeight * 0.2 +
    factors.contentQuality * 0.15
  )
  
  return { article, score, factors }
}

// Get category distribution
function getCategoryDistribution(articles: ScoredArticle[]): Record<string, number> {
  const distribution: Record<string, number> = {}
  
  articles.forEach(scored => {
    const category = scored.article.category
    distribution[category] = (distribution[category] || 0) + 1
  })
  
  return distribution
}

serve(async (req) => {
  // Deployment trigger - Enhanced headlines content generation with importance scoring
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests
  const url = new URL(req.url)
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    try {
      const response = {
        status: 'healthy',
        function: 'generate-headlines-content',
        timestamp: new Date().toISOString(),
        version: '2.0-enhanced'
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
          function: 'generate-headlines-content',
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
    // News API keys are optional, but warn if missing
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

    let executionStatus = 'completed'
    let apiCallCount = 0

    // Fetch news from News API
    let newsApiData: any = null
    let newsApiError: string | null = null
    try {
      const newsApiKey = Deno.env.get('NEWS_API_KEY')
      if (newsApiKey) {
        apiCallCount++
        console.log(`Making News API call ${apiCallCount}/2`)
        
        const newsResponse = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${newsApiKey}&pageSize=8`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        if (newsResponse.ok) {
          newsApiData = await newsResponse.json()
          console.log('Successfully fetched News API data')
        } else {
          newsApiError = `News API failed: ${newsResponse.status} ${newsResponse.statusText}`
          console.error('News API failed:', newsResponse.status, newsResponse.statusText)
        }
      } else {
        newsApiError = 'News API key not configured'
        console.warn('News API key not configured')
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        newsApiError = 'News API request timed out'
        console.error('News API timeout error:', error)
      } else {
        newsApiError = `News API error: ${error.message}`
        console.error('News API error:', error)
      }
    }

    // Fetch news from GNews API
    let gnewsData: any = null
    let gnewsError: string | null = null
    try {
      const gnewsApiKey = Deno.env.get('GNEWS_API_KEY')
      if (gnewsApiKey) {
        apiCallCount++
        console.log(`Making GNews API call ${apiCallCount}/2`)
        
        const gnewsResponse = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&country=us&token=${gnewsApiKey}&max=8`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        if (gnewsResponse.ok) {
          gnewsData = await gnewsResponse.json()
          console.log('Successfully fetched GNews API data')
        } else {
          gnewsError = `GNews API failed: ${gnewsResponse.status} ${gnewsResponse.statusText}`
          console.error('GNews API failed:', gnewsResponse.status, gnewsResponse.statusText)
        }
      } else {
        gnewsError = 'GNews API key not configured'
        console.warn('GNews API key not configured')
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        gnewsError = 'GNews API request timed out'
        console.error('GNews API timeout error:', error)
      } else {
        gnewsError = `GNews API error: ${error.message}`
        console.error('GNews API error:', error)
      }
    }

    // Determine execution status based on API results
    if (newsApiError && gnewsError) {
      executionStatus = 'completed_with_errors'
    } else if (newsApiError || gnewsError) {
      executionStatus = 'completed_with_warnings'
    }

    // Log API calls (with error handling)
    try {
      await supabaseClient
        .from('logs')
        .insert([
          {
            event_type: 'api_call',
            status: newsApiError ? 'error' : 'success',
            message: newsApiError || 'News API data fetched successfully',
            metadata: { 
              api: 'news_api',
              execution_status: executionStatus
            }
          },
          {
            event_type: 'api_call',
            status: gnewsError ? 'error' : 'success',
            message: gnewsError || 'GNews API data fetched successfully',
            metadata: { 
              api: 'gnews_api',
              execution_status: executionStatus
            }
          }
        ])
    } catch (logError) {
      console.error('Failed to log API calls:', logError)
    }

    // Enhanced content processing with importance scoring
    let content = 'Top Headlines: '
    const processedArticles: ProcessedArticle[] = []

    // Process News API articles
    if (newsApiData?.articles) {
      newsApiData.articles.slice(0, 8).forEach((article: any) => {
        const processed: ProcessedArticle = {
          title: article.title || '',
          description: article.description || article.content || '',
          summary: article.summary || '',
          source: article.source?.name || 'Unknown',
          url: article.url || '',
          publishedAt: article.publishedAt || '',
          category: extractCategory(article.title || '', article.description || ''),
          content: article.content?.substring(0, 200) || '',
          author: article.author || 'Unknown',
          rawData: article
        }
        processedArticles.push(processed)
      })
    }

    // Process GNews API articles
    if (gnewsData?.articles) {
      gnewsData.articles.slice(0, 8).forEach((article: any) => {
        const processed: ProcessedArticle = {
          title: article.title || '',
          description: article.description || article.content || '',
          summary: article.summary || '',
          source: article.source?.name || 'Unknown',
          url: article.url || '',
          publishedAt: article.publishedAt || '',
          category: extractCategory(article.title || '', article.description || ''),
          content: article.content?.substring(0, 200) || '',
          author: article.author || 'Unknown',
          rawData: article
        }
        processedArticles.push(processed)
      })
    }

    // Score all articles and select top stories
    const scoredArticles = processedArticles.map(article => calculateImportanceScore(article))
    const topStories = scoredArticles
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    // Create enhanced content with descriptions
    if (topStories.length > 0) {
      const storySummaries = topStories.map(story => {
        const desc = story.article.description || story.article.content?.substring(0, 100) || ''
        return `${story.article.title}. ${desc}`
      })
      content += storySummaries.join('. ')
    } else if (newsApiError && gnewsError) {
      content += 'Headlines temporarily unavailable due to API issues. Please check back later.'
    } else {
      content += 'No headlines available'
    }

    // Determine content block status
    let finalStatus = ContentBlockStatus.CONTENT_READY
    if (newsApiError && gnewsError && topStories.length === 0) {
      finalStatus = ContentBlockStatus.CONTENT_FAILED
    }

    // Calculate category distribution and average importance score
    const categoryDistribution = getCategoryDistribution(topStories)
    const averageImportanceScore = topStories.length > 0 
      ? topStories.reduce((sum, s) => sum + s.score, 0) / topStories.length 
      : 0

    // Create enhanced content block with rich parameters
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'headlines',
      date: utcDateStr,
      content: content,
      parameters: {
        news_api_data: newsApiData,
        gnews_data: gnewsData,
        news_api_error: newsApiError,
        gnews_error: gnewsError,
        processed_articles: processedArticles,
        top_stories: topStories,
        category_distribution: categoryDistribution,
        average_importance_score: averageImportanceScore,
        execution_status: executionStatus,
        api_call_count: apiCallCount,
        processing_version: '2.0-enhanced'
      },
      status: finalStatus,
      content_priority: 3,
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
    validateObjectShape(data, ['id', 'content_type', 'date', 'status'])

    // Log successful content generation (with error handling)
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generated',
          status: 'success',
          message: 'Enhanced headlines content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'headlines', 
            date: utcDateStr,
            execution_status: executionStatus,
            processing_version: '2.0-enhanced',
            stories_processed: processedArticles.length,
            top_stories_selected: topStories.length,
            average_importance_score: averageImportanceScore
          }
        })
    } catch (logError) {
      console.error('Failed to log successful generation:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        execution_status: executionStatus,
        news_api_error: newsApiError,
        gnews_error: gnewsError,
        api_call_count: apiCallCount,
        processing_version: '2.0-enhanced',
        stories_processed: processedArticles.length,
        top_stories_selected: topStories.length,
        average_importance_score: averageImportanceScore
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating enhanced headlines content:', error)

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
          message: `Enhanced headlines content generation failed: ${error.message}`,
          metadata: { 
            content_type: 'headlines', 
            error: error.toString(),
            errorType: error.name,
            stack: error.stack,
            processing_version: '2.0-enhanced'
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
        content_type: 'headlines',
        processing_version: '2.0-enhanced'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 