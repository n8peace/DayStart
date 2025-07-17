import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate required environment variables
  validateEnvVars([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ALPHA_VANTAGE_API_KEY'
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

    // Fetch market data from Alpha Vantage API
    let marketData = null
    let marketError = null
    try {
      const alphaVantageApiKey = Deno.env.get('ALPHA_VANTAGE_API_KEY')
      if (alphaVantageApiKey) {
        // Fetch major indices data
        const indices = ['^GSPC', '^DJI', '^TNX'] // S&P 500, NASDAQ, Dow Jones
        const marketResults = {}
        for (const symbol of indices) {
          try {
            const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${alphaVantageApiKey}`, {
              signal: AbortSignal.timeout(10000) // 10 second timeout
            })
            if (response.ok) {
              const data = await response.json()
              if (data['Global Quote']) {
                marketResults[symbol] = data['Global Quote']
              }
            }
          } catch (error) {
            console.error(`Error fetching ${symbol}:`, error)
          }
        }

        if (Object.keys(marketResults).length > 0) {
          marketData = marketResults
        } else {
          marketError = 'No market data available from Alpha Vantage'
        }
      } else {
        marketError = 'Alpha Vantage API key not configured'
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        marketError = 'Alpha Vantage API request timed out'
      } else {
        marketError = `Alpha Vantage API error: ${error.message}`
      }
    }

    // Log API call
    try {
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'api_call',
          status: marketError ? 'error' : 'success',
          message: marketError || 'Market data fetched successfully',
          metadata: { api: 'alpha_vantage_markets' }
        })
    } catch (logError) {
      safeLogError('Failed to log API call:', logError)
    }

    // Create market content summary
    let content = 'Market Update: '
    const marketSummary = []

    if (marketData) {
      for (const [symbol, data] of Object.entries(marketData)) {
        const quote = data as any
        const price = quote['05. price']
        const change = quote['09. change']
        const changePercent = quote['10. change percent']
        
        if (price && change) {
          const changeDirection = parseFloat(change) >= 0 ? '+' : ''
          marketSummary.push(`${symbol}: $${price} (${changeDirection}${change.toFixed(2)}%, ${changePercent.toFixed(2)}%)`)
        }
      }
    }

    if (marketSummary.length > 0) {
      content += marketSummary.join('. ')
    } else {
      content += 'Market data unavailable'
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'markets',
      date: utcDateStr,
      content: content,
      parameters: {
        market_data: marketData,
        market_error: marketError,
        market_summary: marketSummary
      },
      status: marketError ? ContentBlockStatus.CONTENT_FAILED : ContentBlockStatus.CONTENT_READY,
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
          metadata: { content_type: 'markets', date: utcDateStr }
        })
    } catch (logError) {
      safeLogError('Failed to log successful generation:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        market_error: marketError
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