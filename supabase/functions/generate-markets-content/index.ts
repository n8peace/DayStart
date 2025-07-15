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

    // Get UTC date for markets content
    const utcDate = new Date().toISOString().split('T')[0]

    // Get expiration date (72 hours from now) in UTC
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Fetch market data from Yahoo Finance API via Rapid API
    let yahooData = null
    let yahooError = null
    try {
      const rapidApiKey = Deno.env.get('RAPID_API_KEY')
      if (rapidApiKey) {
        const yahooResponse = await fetch('https://apidojo-yahoo-finance-v1.p.rapidapi.com/stock/v2/get-timeseries?symbol=^GSPC&region=US&interval=1d&range=1d', {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
          }
        })
        if (yahooResponse.ok) {
          yahooData = await yahooResponse.json()
        } else {
          yahooError = `Yahoo Finance API failed: ${yahooResponse.status}`
        }
      } else {
        yahooError = 'Rapid API key not configured'
      }
    } catch (error) {
      yahooError = `Yahoo Finance API error: ${error.message}`
    }

    // Fetch business news from News API
    let businessNewsData = null
    let businessNewsError = null
    try {
      const newsApiKey = Deno.env.get('NEWS_API_KEY')
      if (newsApiKey) {
        const businessResponse = await fetch(`https://newsapi.org/v2/top-headlines?category=business&country=us&apiKey=${newsApiKey}&pageSize=3`)
        if (businessResponse.ok) {
          businessNewsData = await businessResponse.json()
        } else {
          businessNewsError = `Business News API failed: ${businessResponse.status}`
        }
      } else {
        businessNewsError = 'News API key not configured'
      }
    } catch (error) {
      businessNewsError = `Business News API error: ${error.message}`
    }

    // Log API calls
    await supabaseClient
      .from('logs')
      .insert([
        {
          event_type: 'api_call',
          status: yahooError ? 'error' : 'success',
          message: yahooError || 'Yahoo Finance API data fetched successfully',
          metadata: { api: 'yahoo_finance_api' }
        },
        {
          event_type: 'api_call',
          status: businessNewsError ? 'error' : 'success',
          message: businessNewsError || 'Business News API data fetched successfully',
          metadata: { api: 'business_news_api' }
        }
      ])

    // Create content summary
    let content = 'Market Update: '
    const marketInfo = []

    if (yahooData?.chart?.result?.[0]) {
      const result = yahooData.chart.result[0]
      const symbol = result.meta?.symbol
      const currentPrice = result.meta?.regularMarketPrice
      const previousClose = result.meta?.previousClose
      
      if (symbol && currentPrice && previousClose) {
        const change = ((currentPrice - previousClose) / previousClose) * 100
        marketInfo.push(`${symbol}: $${currentPrice.toFixed(2)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`)
      }
    }

    if (businessNewsData?.articles) {
      const businessHeadlines = businessNewsData.articles.slice(0, 2).map((article: any) => article.title)
      marketInfo.push(`Business News: ${businessHeadlines.join('. ')}`)
    }

    if (marketInfo.length > 0) {
      content += marketInfo.join('. ')
    } else {
      content += 'No market data available'
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'markets',
      date: utcDate,
      content: content,
      parameters: {
        yahoo_data: yahooData,
        business_news_data: businessNewsData,
        yahoo_error: yahooError,
        business_news_error: businessNewsError,
        market_info: marketInfo
      },
      status: (yahooError && businessNewsError) ? 'content_failed' : 'content_ready',
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
      throw error
    }

    // Log successful content generation
    await supabaseClient
      .from('logs')
      .insert({
        event_type: 'content_generated',
        status: 'success',
        message: 'Markets content generated successfully',
        content_block_id: data.id,
        metadata: { content_type: 'markets', date: utcDate }
      })

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        yahoo_error: yahooError,
        business_news_error: businessNewsError
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating markets content:', error)

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
          message: `Markets content generation failed: ${error.message}`,
          metadata: { content_type: 'markets', error: error.toString() }
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