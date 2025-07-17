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
        function: 'generate-headlines-content',
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
        
        const newsResponse = await fetch(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${newsApiKey}&pageSize=5`, {
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
        
        const gnewsResponse = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&country=us&token=${gnewsApiKey}&max=5`, {
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
    } else if (newsApiError && gnewsError) {
      content += 'Headlines temporarily unavailable due to API issues. Please check back later.'
    } else {
      content += 'No headlines available'
    }

    // Determine content block status
    let finalStatus = ContentBlockStatus.CONTENT_READY
    if (newsApiError && gnewsError && headlines.length === 0) {
      finalStatus = ContentBlockStatus.CONTENT_FAILED
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
        headlines: headlines,
        execution_status: executionStatus,
        api_call_count: apiCallCount
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
          message: 'Headlines content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'headlines', 
            date: utcDateStr,
            execution_status: executionStatus
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
        api_call_count: apiCallCount
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating headlines content:', error)

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
          message: `Headlines content generation failed: ${error.message}`,
          metadata: { 
            content_type: 'headlines', 
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
        content_type: 'headlines'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 