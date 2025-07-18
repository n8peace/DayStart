import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

// Enhanced interfaces for market data processing
interface MarketData {
  symbol: string
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  rawData: any
}

interface ProcessedBusinessArticle {
  title: string
  description: string
  source: string
  url: string
  publishedAt: string
  category: string
  content: string
  rawData: any
}

interface ScoredBusinessArticle {
  article: ProcessedBusinessArticle
  score: number
  factors: {
    sourceReliability: number
    recency: number
    marketRelevance: number
    impact: number
    contentQuality: number
  }
}

interface MarketTrend {
  overallDirection: 'bullish' | 'bearish' | 'neutral'
  volatility: 'low' | 'medium' | 'high'
  keyMovers: string[]
  summary: string
}

// Market data importance scoring
function calculateMarketDataImportance(marketData: MarketData): number {
  let score = 0.5 // Base score
  
  // Volume-based scoring
  if (marketData.volume > 1000000000) score += 0.2 // High volume
  else if (marketData.volume > 500000000) score += 0.1 // Medium volume
  
  // Market cap weighting
  if (marketData.marketCap > 1000000000000) score += 0.1 // Large cap
  else if (marketData.marketCap > 10000000000) score += 0.05 // Mid cap
  
  // Change magnitude
  const changePercent = Math.abs(marketData.changePercent)
  if (changePercent > 5) score += 0.2 // Significant move
  else if (changePercent > 2) score += 0.1 // Notable move
  
  return Math.max(0, Math.min(1, score))
}

// Business news category extraction
function extractBusinessCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()
  
  const categories = {
    earnings: ['earnings', 'quarterly', 'revenue', 'profit', 'loss', 'financial results', 'q1', 'q2', 'q3', 'q4'],
    markets: ['stock', 'market', 'trading', 'investor', 'portfolio', 'investment', 'bull', 'bear'],
    economy: ['economy', 'economic', 'gdp', 'inflation', 'interest rate', 'federal reserve', 'fed'],
    corporate: ['company', 'ceo', 'executive', 'board', 'merger', 'acquisition', 'layoff', 'hiring'],
    technology: ['tech', 'ai', 'software', 'digital', 'innovation', 'startup', 'funding'],
    regulation: ['regulation', 'law', 'policy', 'government', 'compliance', 'legal'],
    global: ['international', 'trade', 'tariff', 'global', 'foreign', 'export', 'import']
  }
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category
    }
  }
  
  return 'general'
}

// Business news source reliability (similar to headlines but focused on business sources)
function getBusinessSourceReliabilityScore(sourceName: string): number {
  const reliabilityScores = {
    // High reliability business sources (0.9-1.0)
    'Bloomberg': 0.95,
    'Reuters': 0.95,
    'The Wall Street Journal': 0.95,
    'Financial Times': 0.95,
    'CNBC': 0.9,
    'MarketWatch': 0.9,
    'Yahoo Finance': 0.85,
    'Forbes': 0.85,
    'Business Insider': 0.8,
    'The Economist': 0.9,
    
    // General news sources with good business coverage
    'Associated Press': 0.85,
    'The New York Times': 0.85,
    'The Washington Post': 0.85,
    'USA Today': 0.8,
    'CNN': 0.75,
    'ABC News': 0.75,
    'CBS News': 0.75,
    'NBC News': 0.75,
    
    // Lower reliability
    'Daily Mail': 0.5,
    'Breitbart': 0.4,
    'HuffPost': 0.6
  }
  
  return reliabilityScores[sourceName] || 0.6
}

// Market relevance scoring for business news
function calculateMarketRelevance(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase()
  let relevance = 0.5 // Base score
  
  // High market relevance keywords
  const highRelevance = [
    'stock', 'market', 'trading', 'investor', 'earnings', 'revenue', 'profit',
    's&p 500', 'dow jones', 'nasdaq', 'federal reserve', 'interest rate',
    'inflation', 'gdp', 'economy', 'recession', 'bull market', 'bear market'
  ]
  
  // Medium relevance keywords
  const mediumRelevance = [
    'company', 'business', 'corporate', 'ceo', 'executive', 'merger',
    'acquisition', 'layoff', 'hiring', 'expansion', 'growth', 'decline'
  ]
  
  highRelevance.forEach(term => {
    if (text.includes(term)) relevance += 0.1
  })
  
  mediumRelevance.forEach(term => {
    if (text.includes(term)) relevance += 0.05
  })
  
  return Math.max(0, Math.min(1, relevance))
}

// Calculate business article importance score
function calculateBusinessArticleScore(article: ProcessedBusinessArticle): ScoredBusinessArticle {
  const factors = {
    sourceReliability: getBusinessSourceReliabilityScore(article.source),
    recency: calculateRecencyScore(article.publishedAt),
    marketRelevance: calculateMarketRelevance(article.title, article.description),
    impact: calculateImpactScore(article.title, article.description),
    contentQuality: calculateContentQuality(article.description, article.content)
  }
  
  // Weighted average with emphasis on market relevance
  const score = (
    factors.sourceReliability * 0.15 +
    factors.recency * 0.15 +
    factors.marketRelevance * 0.35 +
    factors.impact * 0.2 +
    factors.contentQuality * 0.15
  )
  
  return { article, score, factors }
}

// Market trend analysis
function analyzeMarketTrends(marketData: Record<string, MarketData>): MarketTrend {
  const symbols = Object.keys(marketData)
  let bullishCount = 0
  let bearishCount = 0
  let totalChangePercent = 0
  let maxChange = 0
  let keyMovers: string[] = []
  
  symbols.forEach(symbol => {
    const data = marketData[symbol]
    const changePercent = data.changePercent
    
    totalChangePercent += changePercent
    
    if (changePercent > 0) bullishCount++
    else if (changePercent < 0) bearishCount++
    
    if (Math.abs(changePercent) > Math.abs(maxChange)) {
      maxChange = changePercent
    }
    
    // Identify significant movers (>2% change)
    if (Math.abs(changePercent) > 2) {
      const symbolName = getSymbolDisplayName(symbol)
      keyMovers.push(`${symbolName}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`)
    }
  })
  
  const avgChange = totalChangePercent / symbols.length
  const overallDirection = bullishCount > bearishCount ? 'bullish' : 
                          bearishCount > bullishCount ? 'bearish' : 'neutral'
  
  // Determine volatility based on average change magnitude
  const volatility = Math.abs(avgChange) > 3 ? 'high' : 
                    Math.abs(avgChange) > 1 ? 'medium' : 'low'
  
  const summary = `Markets showing ${overallDirection} sentiment with ${volatility} volatility. Average change: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%`
  
  return {
    overallDirection,
    volatility,
    keyMovers: keyMovers.slice(0, 3), // Top 3 movers
    summary
  }
}

// Utility functions (reused from headlines)
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
    'earnings', 'revenue', 'profit', 'loss', 'merger', 'acquisition',
    'ceo', 'executive', 'federal reserve', 'interest rate', 'inflation'
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

function getSymbolDisplayName(symbol: string): string {
  const symbolNames: Record<string, string> = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    '^TNX': '10-Year Treasury',
    '^IXIC': 'NASDAQ',
    '^VIX': 'VIX',
    '^RUT': 'Russell 2000'
  }
  return symbolNames[symbol] || symbol
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
        function: 'generate-markets-content',
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
          function: 'generate-markets-content',
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
    'SUPABASE_SERVICE_ROLE_KEY'
    // RAPIDAPI_KEY and NEWS_API_KEY are optional - will use fallbacks if missing
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

    // Enhanced logging for API quota monitoring
    const logApiCall = async (symbol: string, status: string, details: any) => {
      try {
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'api_call',
            status: status,
            message: `Yahoo Finance API call for ${symbol}`,
            metadata: { 
              api: 'yahoo_finance_markets',
              symbol: symbol,
              details: details,
              timestamp: new Date().toISOString()
            }
          })
      } catch (logError) {
        console.error(`Failed to log API call for ${symbol}:`, logError)
      }
    }

    // Fetch market data from Yahoo Finance API via RapidAPI with enhanced error handling
    let marketData: any = null
    let marketError: string | null = null
    let quotaExceeded = false
    let apiCallCount = 0
    
    try {
      const rapidApiKey = Deno.env.get('RAPIDAPI_KEY')
      if (rapidApiKey) {
        // Fetch major indices data - using Yahoo Finance symbols
        const symbols = ['^GSPC', '^DJI', '^TNX'] // S&P 500, Dow Jones, 10-Year Treasury
        const marketResults = {}
        
        // Make a single API call for all symbols (more efficient)
        try {
          apiCallCount++
          console.log(`Making Yahoo Finance API call for symbols: ${symbols.join(', ')}`)
          
          const symbolsParam = symbols.join('%2C') // URL encode comma
          const response = await fetch(`https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-quotes?region=US&symbols=${symbolsParam}`, {
            headers: {
              'x-rapidapi-host': 'apidojo-yahoo-finance-v1.p.rapidapi.com',
              'x-rapidapi-key': rapidApiKey
            },
            signal: AbortSignal.timeout(15000) // 15 second timeout
          })
          
          const responseText = await response.text()
          let data
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            console.error(`Failed to parse JSON response:`, responseText)
            await logApiCall('all_symbols', 'error', { 
              error: 'JSON parse failed', 
              responseText: responseText.substring(0, 500),
              status: response.status 
            })
            throw new Error('Failed to parse API response')
          }
          
          // Log the API response for debugging
          console.log(`Yahoo Finance API response:`, JSON.stringify(data, null, 2))
          
          // Check for quota/rate limiting errors
          if (response.status === 429 || data.error || data.message?.includes('quota')) {
            const errorMessage = data.error || data.message || 'Rate limit exceeded'
            console.error(`Quota/Rate limit error:`, errorMessage)
            quotaExceeded = true
            await logApiCall('all_symbols', 'quota_exceeded', { 
              error: errorMessage, 
              status: response.status,
              headers: Object.fromEntries(response.headers.entries())
            })
            throw new Error('API quota exceeded')
          }
          
          // Check for API key errors
          if (response.status === 401 || response.status === 403) {
            const errorMessage = data.error || data.message || 'API key error'
            console.error(`API key error:`, errorMessage)
            await logApiCall('all_symbols', 'auth_error', { 
              error: errorMessage, 
              status: response.status 
            })
            throw new Error('API authentication failed')
          }
          
          if (response.ok && data.quoteResponse && data.quoteResponse.result) {
            const quotes = data.quoteResponse.result
            for (const quote of quotes) {
              const symbol = quote.symbol
              if (symbols.includes(symbol)) {
                marketResults[symbol] = {
                  symbol: quote.symbol,
                  price: quote.regularMarketPrice,
                  change: quote.regularMarketChange,
                  changePercent: quote.regularMarketChangePercent,
                  volume: quote.regularMarketVolume,
                  marketCap: quote.marketCap
                }
              }
            }
            
            await logApiCall('all_symbols', 'success', { 
              status: response.status,
              symbols_fetched: Object.keys(marketResults),
              hasData: Object.keys(marketResults).length > 0
            })
          } else {
            console.warn(`No market data in response:`, data)
            await logApiCall('all_symbols', 'no_data', { 
              status: response.status,
              response: data 
            })
          }
          
        } catch (error) {
          console.error(`Error fetching market data:`, error)
          await logApiCall('all_symbols', 'error', { 
            error: error.message,
            errorType: error.name,
            stack: error.stack 
          })
          throw error
        }

        if (Object.keys(marketResults).length > 0) {
          // Enhanced market data processing
          const processedMarketData: Record<string, MarketData> = {}
          
          for (const [symbol, data] of Object.entries(marketResults)) {
            const quote = data as any
            processedMarketData[symbol] = {
              symbol: quote.symbol,
              price: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              volume: quote.volume,
              marketCap: quote.marketCap,
              rawData: quote
            }
          }
          
          marketData = processedMarketData
          console.log('Successfully fetched and processed market data:', Object.keys(marketData))
        } else if (quotaExceeded) {
          marketError = 'Yahoo Finance API quota exceeded - please increase quota or wait for reset'
        } else {
          marketError = 'No market data available from Yahoo Finance'
        }
      } else {
        marketError = 'RapidAPI key not configured - using fallback content'
        console.warn('RAPIDAPI_KEY not configured, using fallback market content')
        
        // Log the missing API key configuration
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'api_call',
              status: 'warning',
              message: 'RapidAPI key not configured - using fallback market content',
              metadata: { 
                api: 'yahoo_finance_markets',
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
      if (error.name === 'TimeoutError') {
        marketError = 'Yahoo Finance API request timed out'
        console.error('API timeout error:', error)
      } else {
        marketError = `Yahoo Finance API error: ${error.message}`
        console.error('API general error:', error)
      }
      
      // Log the overall API error
      try {
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'api_error',
            status: 'error',
            message: `Yahoo Finance API general error: ${error.message}`,
            metadata: { 
              api: 'yahoo_finance_markets',
              error: error.toString(),
              errorType: error.name,
              stack: error.stack
            }
          })
      } catch (logError) {
        console.error('Failed to log API error:', logError)
      }
    }

    // Fetch business news headlines for additional context
    let businessNews: any = null
    let newsError: string | null = null
    
    try {
      const newsApiKey = Deno.env.get('NEWS_API_KEY')
      if (newsApiKey) {
        apiCallCount++
        console.log('Making News API call for business headlines')
        
        const response = await fetch(`https://newsapi.org/v2/top-headlines?category=business&country=us&apiKey=${newsApiKey}&pageSize=3`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        
        if (response.ok) {
          const rawBusinessNews = await response.json()
          
          // Enhanced business news processing
          if (rawBusinessNews.articles && rawBusinessNews.articles.length > 0) {
            const processedArticles: ProcessedBusinessArticle[] = []
            
            rawBusinessNews.articles.slice(0, 8).forEach((article: any) => {
              const processed: ProcessedBusinessArticle = {
                title: article.title || '',
                description: article.description || article.content || '',
                source: article.source?.name || 'Unknown',
                url: article.url || '',
                publishedAt: article.publishedAt || '',
                category: extractBusinessCategory(article.title || '', article.description || ''),
                content: article.content?.substring(0, 200) || '',
                rawData: article
              }
              processedArticles.push(processed)
            })
            
            // Score and rank articles
            const scoredArticles = processedArticles.map(article => calculateBusinessArticleScore(article))
            const topArticles = scoredArticles
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
            
            businessNews = {
              rawData: rawBusinessNews,
              processedArticles: processedArticles,
              scoredArticles: scoredArticles,
              topArticles: topArticles,
              averageScore: topArticles.length > 0 ? 
                topArticles.reduce((sum, a) => sum + a.score, 0) / topArticles.length : 0
            }
            
            console.log(`Successfully processed ${processedArticles.length} business articles, selected top ${topArticles.length}`)
          } else {
            businessNews = { rawData: rawBusinessNews, processedArticles: [], scoredArticles: [], topArticles: [], averageScore: 0 }
            console.log('No business articles found in response')
          }
        } else {
          newsError = `News API failed: ${response.status}`
          console.error('News API failed:', response.status)
        }
      } else {
        newsError = 'News API key not configured - skipping business news'
        console.warn('NEWS_API_KEY not configured, skipping business news')
        
        // Log the missing News API key configuration
        try {
          await supabaseClient
            .from('logs')
            .insert({
              event_type: 'api_call',
              status: 'warning',
              message: 'News API key not configured - skipping business news',
              metadata: { 
                api: 'news_api_business',
                error: 'API key not configured',
                has_fallback: true,
                timestamp: new Date().toISOString()
              }
            })
        } catch (logError) {
          console.error('Failed to log missing News API key:', logError)
        }
      }
    } catch (error: any) {
      newsError = `News API error: ${error.message}`
      console.error('News API error:', error)
    }

    // Enhanced market content generation with trend analysis
    let content = 'Market Update: '
    const marketSummary: Array<{
      symbol: string
      price: number
      change: number
      changePercent: number
      importance: number
      formatted: string
    }> = []
    let marketTrends: MarketTrend | null = null

    if (marketData) {
      // Analyze market trends
      marketTrends = analyzeMarketTrends(marketData as Record<string, MarketData>)
      
      // Create detailed market summary with importance scoring
      for (const [symbol, data] of Object.entries(marketData)) {
        const marketDataItem = data as MarketData
        const price = marketDataItem.price
        const change = marketDataItem.change
        const changePercent = marketDataItem.changePercent
        
        if (price && change !== undefined) {
          const changeDirection = change >= 0 ? '+' : ''
          const changeFormatted = change.toFixed(2)
          const percentFormatted = changePercent.toFixed(2)
          const symbolName = getSymbolDisplayName(symbol)
          const importance = calculateMarketDataImportance(marketDataItem)
          
          marketSummary.push({
            symbol: symbolName,
            price: price,
            change: change,
            changePercent: changePercent,
            importance: importance,
            formatted: `${symbolName}: $${price} (${changeDirection}${changeFormatted}, ${percentFormatted}%)`
          })
        }
      }
      
      // Sort by importance and create content
      marketSummary.sort((a, b) => b.importance - a.importance)
      
      if (marketSummary.length > 0) {
        content += `Live market data: ${marketSummary.map(m => m.formatted).join('. ')}. `
        content += marketTrends.summary
      }
    } else if (quotaExceeded) {
      content += 'Live market data temporarily unavailable due to API quota limits. Using fallback content.'
    } else if (marketError && marketError.includes('RapidAPI key not configured')) {
      content += 'Live market data unavailable - API not configured. Using fallback content.'
    } else if (marketError) {
      content += `Live market data unavailable due to technical issues: ${marketError}. Using fallback content.`
    } else {
      content += 'Live market data unavailable - no data received from API. Using fallback content.'
    }

    // Enhanced business news context
    if (businessNews && businessNews.topArticles && businessNews.topArticles.length > 0) {
      content += ' In business news: '
      const headlines = businessNews.topArticles.map((scored: ScoredBusinessArticle) => {
        const title = scored.article.title.split(' - ')[0] // Remove source from title
        return title
      })
      content += headlines.join('. ')
    } else if (newsError && newsError.includes('not configured')) {
      content += ' Business news unavailable - API not configured.'
    } else if (newsError) {
      content += ` Business news unavailable: ${newsError}.`
    } else {
      content += ' No business news available.'
    }

    // Determine status based on quota issues and errors
    let finalStatus: string = ContentBlockStatus.CONTENT_READY
    let executionStatus = 'completed'
    
    if (quotaExceeded) {
      finalStatus = ContentBlockStatus.CONTENT_READY // Still mark as ready since we have fallback content
      executionStatus = 'completed_with_warnings'
    } else if (marketError && !marketData) {
      finalStatus = ContentBlockStatus.CONTENT_READY // Mark as ready with fallback content
      executionStatus = 'completed_with_fallback'
    }

    // Create enhanced content block with rich parameters
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'markets',
      date: utcDateStr,
      content: content,
      parameters: {
        market_data: marketData,
        market_error: marketError,
        market_summary: marketSummary,
        market_trends: marketTrends,
        business_news: businessNews,
        news_error: newsError,
        quota_exceeded: quotaExceeded,
        api_call_count: apiCallCount,
        execution_status: executionStatus,
        processing_version: '2.0-enhanced',
        market_analysis: {
          symbols_processed: marketData ? Object.keys(marketData).length : 0,
          has_trend_analysis: !!marketTrends,
          business_articles_processed: businessNews?.processedArticles?.length || 0,
          top_business_articles: businessNews?.topArticles?.length || 0,
          average_business_score: businessNews?.averageScore || 0
        }
      },
      status: finalStatus,
      content_priority: 5,
      expiration_date: expirationDateStr,
      language_code: 'en-US'
    }

    const { data, error } = await supabaseClient
      .from('content_blocks')
      .insert(contentBlock)
      .select()
      .single()

    if (error) {
      console.error('Database insert error:', error)
      throw error
    }
    validateObjectShape(data, ['id', 'content_type', 'date', 'status'])

    // Log successful enhanced content generation
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generated',
          status: 'success',
          message: 'Enhanced markets content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'markets', 
            date: utcDateStr,
            quota_exceeded: quotaExceeded,
            api_call_count: apiCallCount,
            has_market_data: !!marketData,
            processing_version: '2.0-enhanced',
            market_trends_analyzed: !!marketTrends,
            business_articles_processed: businessNews?.processedArticles?.length || 0,
            top_business_articles: businessNews?.topArticles?.length || 0
          }
        })
    } catch (logError) {
      safeLogError('Failed to log successful generation:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        market_error: marketError,
        quota_exceeded: quotaExceeded,
        api_call_count: apiCallCount,
        execution_status: executionStatus,
        processing_version: '2.0-enhanced',
        market_analysis: {
          symbols_processed: marketData ? Object.keys(marketData).length : 0,
          has_trend_analysis: !!marketTrends,
          business_articles_processed: businessNews?.processedArticles?.length || 0,
          top_business_articles: businessNews?.topArticles?.length || 0,
          average_business_score: businessNews?.averageScore || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating markets content:', error)

    // Enhanced error logging
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
          message: `Enhanced markets content generation failed: ${error.message}`,
          metadata: { 
            content_type: 'markets', 
            error: error.toString(),
            errorType: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString(),
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
        content_type: 'markets'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 