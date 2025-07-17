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
          marketData = marketResults
          console.log('Successfully fetched market data:', Object.keys(marketResults))
        } else if (quotaExceeded) {
          marketError = 'Yahoo Finance API quota exceeded - please increase quota or wait for reset'
        } else {
          marketError = 'No market data available from Yahoo Finance'
        }
      } else {
        marketError = 'RapidAPI key not configured - using fallback content'
        console.warn('RAPIDAPI_KEY not configured, using fallback market content')
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
          businessNews = await response.json()
          console.log('Successfully fetched business news')
        } else {
          newsError = `News API failed: ${response.status}`
          console.error('News API failed:', response.status)
        }
      } else {
        newsError = 'News API key not configured - skipping business news'
        console.warn('NEWS_API_KEY not configured, skipping business news')
      }
    } catch (error: any) {
      newsError = `News API error: ${error.message}`
      console.error('News API error:', error)
    }

    // Create market content summary with fallback for quota issues
    let content = 'Market Update: '
    const marketSummary = []
    
    // Symbol name mapping for user-friendly display
    const symbolNames: Record<string, string> = {
      '^GSPC': 'S&P 500',
      '^DJI': 'Dow Jones',
      '^TNX': '10-Year Treasury'
    }

    if (marketData) {
      for (const [symbol, data] of Object.entries(marketData)) {
        const quote = data as any
        const price = quote.price
        const change = quote.change
        const changePercent = quote.changePercent
        
        if (price && change !== undefined) {
          const changeDirection = parseFloat(change) >= 0 ? '+' : ''
          const changeFormatted = parseFloat(change).toFixed(2)
          const percentFormatted = parseFloat(changePercent).toFixed(2)
          const symbolName = symbolNames[symbol] || symbol
          marketSummary.push(`${symbolName}: $${price} (${changeDirection}${changeFormatted}, ${percentFormatted}%)`)
        }
      }
    }

    if (marketSummary.length > 0) {
      content += marketSummary.join('. ')
    } else if (quotaExceeded) {
      content += 'Market data temporarily unavailable due to API quota limits. Please check back later.'
    } else if (marketError) {
      content += 'Market data unavailable due to technical issues. Check back later for updates.'
    } else {
      content += 'Market data unavailable'
    }

    // Add business news context if available
    if (businessNews && businessNews.articles && businessNews.articles.length > 0) {
      content += ' In business news: '
      const headlines = businessNews.articles.slice(0, 2).map((article: any) => {
        return article.title.split(' - ')[0] // Remove source from title
      })
      content += headlines.join('. ')
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

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'markets',
      date: utcDateStr,
      content: content,
      parameters: {
        market_data: marketData,
        market_error: marketError,
        market_summary: marketSummary,
        business_news: businessNews,
        news_error: newsError,
        quota_exceeded: quotaExceeded,
        api_call_count: apiCallCount,
        execution_status: executionStatus
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

    // Log successful content generation
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generated',
          status: 'success',
          message: 'Markets content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'markets', 
            date: utcDateStr,
            quota_exceeded: quotaExceeded,
            api_call_count: apiCallCount,
            has_market_data: !!marketData
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
        execution_status: executionStatus
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
          message: `Markets content generation failed: ${error.message}`,
          metadata: { 
            content_type: 'markets', 
            error: error.toString(),
            errorType: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString()
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