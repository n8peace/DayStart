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

    // Fetch news from News API
    let newsApiData = null
    let newsApiError = null
    try {
      const newsApiKey = Deno.env.get('NEWS_API_KEY')
      if (newsApiKey) {
        const newsResponse = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${newsApiKey}&pageSize=5`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        if (newsResponse.ok) {
          newsApiData = await newsResponse.json()
        } else {
          newsApiError = `News API failed: ${newsResponse.status} ${newsResponse.statusText}`
        }
      } else {
        newsApiError = 'News API key not configured'
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        newsApiError = 'News API request timed out'
      } else {
        newsApiError = `News API error: ${error.message}`
      }
    }

    // Fetch news from GNews API
    let gnewsData = null
    let gnewsError = null
    try {
      const gnewsApiKey = Deno.env.get('GNEWS_API_KEY')
      if (gnewsApiKey) {
        const gnewsResponse = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&country=us&token=${gnewsApiKey}&max=5`, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        if (gnewsResponse.ok) {
          gnewsData = await gnewsResponse.json()
        } else {
          gnewsError = `GNews API failed: ${gnewsResponse.status} ${gnewsResponse.statusText}`
        }
      } else {
        gnewsError = 'GNews API key not configured'
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        gnewsError = 'GNews API request timed out'
      } else {
        gnewsError = `GNews API error: ${error.message}`
      }
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
            metadata: { api: 'news_api' }
          },
          {
            event_type: 'api_call',
            status: gnewsError ? 'error' : 'success',
            message: gnewsError || 'GNews API data fetched successfully',
            metadata: { api: 'gnews_api' }
          }
        ])
    } catch (logError) {
      safeLogError('Failed to log API calls:', logError)
      // Continue execution even if logging fails
    }

    // Create content summary
    let content = 'Top Headlines: '
    const headlines = []

    if (newsApiData?.articles) {
      newsApiData.articles.slice(0, 3).forEach((article: any) => {
        headlines.push(article.title)
      })
    }

    if (gnewsData?.articles) {
      gnewsData.articles.slice(0, 2).forEach((article: any) => {
        headlines.push(article.title)
      })
    }

    if (headlines.length > 0) {
      content += headlines.join('. ')
    } else {
      content += 'No headlines available'
    }

    // Create content block
    const contentBlock: Partial<ContentBlock> = {
      content_type: 'headlines',
      date: utcDateStr,
      content: content,
      parameters: {
        news_api_data: newsApiData,
        gnews_data: gnewsData,
        news_api_error: newsApiError,
        gnews_error: gnewsError,
        headlines: headlines
      },
      status: (newsApiError && gnewsError) ? ContentBlockStatus.CONTENT_FAILED : ContentBlockStatus.CONTENT_READY,
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
          message: 'Headlines content generated successfully',
          content_block_id: data.id,
          metadata: { content_type: 'headlines', date: utcDateStr }
        })
    } catch (logError) {
      safeLogError('Failed to log successful generation:', logError)
      // Continue execution even if logging fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_block: data,
        news_api_error: newsApiError,
        gnews_error: gnewsError
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    safeLogError('Error generating headlines content:', error)

    // Log error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)
        
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'content_generation_failed',
            status: 'error',
            message: `Headlines content generation failed: ${error.message}`,
            metadata: { 
              content_type: 'headlines', 
              error: error.toString(),
              stack: error.stack
            }
          })
      }
    } catch (logError) {
      safeLogError('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error.stack || 'No stack trace available'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 