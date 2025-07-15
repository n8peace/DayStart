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

interface WeatherData {
  id: string
  location_key: string
  date: string
  weather_data: any
  last_updated: string
  expires_at: string
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

    // Get UTC date for weather content
    const utcDate = new Date().toISOString().split('T')[0]

    // Get expiration date (72 hours from now) in UTC
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 72)
    const expirationDateStr = expirationDate.toISOString().split('T')[0]

    // Get today's date for weather data lookup
    const todayForLookup = new Date().toISOString().split('T')[0]

    // Fetch weather data from user_weather_data table
    const { data: weatherData, error: weatherError } = await supabaseClient
      .from('user_weather_data')
      .select('*')
      .eq('date', todayForLookup)
      .not('expires_at', 'lt', new Date().toISOString())

    if (weatherError) {
      throw new Error(`Failed to fetch weather data: ${weatherError.message}`)
    }

    if (!weatherData || weatherData.length === 0) {
      // Log no weather data available
      await supabaseClient
        .from('logs')
        .insert({
          event_type: 'content_generation_failed',
          status: 'error',
          message: 'No weather data available for content generation',
          metadata: { content_type: 'weather', date: utcDate }
        })

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No weather data available' 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Process each weather data record
    const results = []
    for (const weather of weatherData) {
      try {
        const weatherInfo = weather.weather_data
        
        // Extract weather information
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

        // Create content summary
        const content = `Location: ${city}, ${state}. High: ${high}°F, Low: ${low}°F. Condition: ${condition}. Sunrise: ${sunrise}, Sunset: ${sunset}`

        // Create content block
        const contentBlock: Partial<ContentBlock> = {
          content_type: 'weather',
          date: utcDate,
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
            sunset: sunset
          },
          status: 'content_ready',
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

        results.push(data)

        // Log successful content generation
        await supabaseClient
          .from('logs')
          .insert({
            event_type: 'content_generated',
            status: 'success',
            message: 'Weather content generated successfully',
            content_block_id: data.id,
            metadata: { 
              content_type: 'weather', 
              date: utcDate,
              location_key: weather.location_key 
            }
          })

      } catch (error) {
        console.error(`Error processing weather data for ${weather.location_key}:`, error)
        
        // Log individual weather processing error
        await supabaseClient
          .from('logs')
          .insert({
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        content_blocks: results,
        total_processed: weatherData.length,
        successful: results.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error generating weather content:', error)

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
          message: `Weather content generation failed: ${error.message}`,
          metadata: { content_type: 'weather', error: error.toString() }
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