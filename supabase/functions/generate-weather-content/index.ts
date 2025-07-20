// Last Updated: 2024-07-19
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
        function: 'generate-weather-content',
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
          function: 'generate-weather-content',
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
    const todayForLookup = utcDate()

    let weatherData: any[] = []
    let weatherError: string | null = null
    let executionStatus = 'completed'

    try {
      const { data, error } = await supabaseClient
        .from('user_weather_data')
        .select('*')
        .eq('date', todayForLookup)
        .not('expires_at', 'lt', new Date().toISOString())

      if (error) {
        throw new Error(`Failed to fetch weather data: ${error.message}`)
      }

      weatherData = data || []
    } catch (error) {
      weatherError = `Database error: ${error.message}`
      executionStatus = 'completed_with_errors'
      console.error('Error fetching weather data:', error)
      
      await safeLogError(supabaseClient, {
        event_type: 'database_error',
        status: 'error',
        message: `Failed to fetch weather data: ${error.message}`,
        metadata: { content_type: 'weather', date: utcDateStr, error: error.toString() }
      })
    }

    const results: ContentBlock[] = []
    let successfulCount = 0
    let failedCount = 0

    if (weatherData.length === 0) {
      // Create fallback content when no weather data is available
      const fallbackContent = 'Weather information is currently unavailable. Please check back later for updated conditions.'
      const fallbackBlock: Partial<ContentBlock> = {
        content_type: 'weather',
        date: utcDateStr,
        content: fallbackContent,
        parameters: {
          fallback_content: true,
          weather_error: weatherError || 'No weather data available',
          execution_status: 'completed_with_warnings'
        },
        status: ContentBlockStatus.CONTENT_READY, // Still ready since we have fallback content
        content_priority: 2,
        expiration_date: expirationDateStr,
        language_code: 'en-US'
      }

      try {
        const { data, error } = await supabaseClient
          .from('content_blocks')
          .insert(fallbackBlock)
          .select()
          .single()

        if (error) {
          throw error
        }

        results.push(data)
        successfulCount++

        await safeLogError(supabaseClient, {
          event_type: 'content_generated',
          status: 'success',
          message: 'Weather fallback content generated successfully',
          content_block_id: data.id,
          metadata: { 
            content_type: 'weather', 
            date: utcDateStr,
            fallback_content: true
          }
        })
      } catch (error) {
        console.error('Error creating fallback weather content:', error)
        failedCount++
        
        await safeLogError(supabaseClient, {
          event_type: 'content_generation_failed',
          status: 'error',
          message: `Weather fallback content generation failed: ${error.message}`,
          metadata: { 
            content_type: 'weather', 
            date: utcDateStr,
            error: error.toString() 
          }
        })
      }
    } else {
      // Process actual weather data
      for (const weather of weatherData) {
        try {
          validateObjectShape(weather, ['id', 'location_key', 'date', 'weather_data'])
          const weatherInfo = weather.weather_data
          const location = weatherInfo.location || {}
          const current = weatherInfo.current || {}
          const forecast = weatherInfo.forecast || {}
          const city = location.city || 'Unknown'
          const state = location.state || ''
          const high = forecast.high || 'N/A'
          const low = forecast.low || 'N/A'
          const condition = current.condition || 'Unknown'
          const sunrise = current.sunrise || 'N/A'
          const sunset = current.sunset || 'N/A'
          const content = `Location: ${city}, ${state}. High: ${high}°F, Low: ${low}°F. Condition: ${condition}. Sunrise: ${sunrise}, Sunset: ${sunset}`
          
          const contentBlock: Partial<ContentBlock> = {
            content_type: 'weather',
            date: utcDateStr,
            content: content,
            parameters: {
              user_weather_data_id: weather.id,
              location_key: weather.location_key,
              weather_data: weatherInfo,
              city: city,
              state: state,
              high: high,
              low: low,
              condition: condition,
              sunrise: sunrise,
              sunset: sunset,
              execution_status: executionStatus
            },
            status: ContentBlockStatus.CONTENT_READY,
            content_priority: 2,
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
          results.push(data)
          successfulCount++

          await safeLogError(supabaseClient, {
            event_type: 'content_generated',
            status: 'success',
            message: 'Weather content generated successfully',
            content_block_id: data.id,
            metadata: { 
              content_type: 'weather', 
              date: utcDateStr,
              location_key: weather.location_key 
            }
          })
        } catch (error) {
          console.error(`Error processing weather data for ${weather.location_key}:`, error)
          failedCount++
          
          await safeLogError(supabaseClient, {
            event_type: 'content_generation_failed',
            status: 'error',
            message: `Weather content generation failed for location ${weather.location_key}: ${error.message}`,
            metadata: { 
              content_type: 'weather', 
              location_key: weather.location_key,
              error: error.toString() 
            }
          })
        }
      }
    }

    // Determine final execution status
    if (failedCount > 0 && successfulCount === 0) {
      executionStatus = 'completed_with_errors'
    } else if (failedCount > 0) {
      executionStatus = 'completed_with_warnings'
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_blocks: results,
        total_processed: weatherData.length,
        successful: successfulCount,
        failed: failedCount,
        execution_status: executionStatus,
        weather_error: weatherError
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating weather content:', error)
    
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await safeLogError(supabaseClient, {
        event_type: 'content_generation_failed',
        status: 'error',
        message: `Weather content generation failed: ${error.message}`,
        metadata: { content_type: 'weather', error: error.toString() }
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
        content_type: 'weather'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Always 200 for cron job success
      }
    )
  }
}) 