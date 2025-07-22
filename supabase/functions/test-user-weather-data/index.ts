// Last Updated: 2024-07-21
// Example request body:
// {
//   "user_id": "123e4567-e89b-12d3-a456-426614174000"
// }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'

serve(async (req: Request) => {
  // Validate environment
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  let user_id: string | undefined
  try {
    const body = await req.json()
    user_id = body.user_id
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  if (!user_id) {
    return new Response(JSON.stringify({ error: 'Missing user_id' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Generate test weather data
  const today = utcDate(0)
  const tomorrow = utcDate(1)
  const testWeather = {
    location_key: '10001',
    date: today,
    weather_data: { summary: 'Sunny', temp: 75, user_id },
    expires_at: tomorrow,
  }

  try {
    const { data, error } = await supabaseClient.from('user_weather_data').insert([testWeather]).select()
    if (error) {
      await safeLogError(supabaseClient, {
        event_type: 'test_user_weather_data_create_failed',
        status: 'error',
        message: error.message,
        metadata: { testWeather },
      })
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
    // Log successful test weather data creation
    await safeLogError(supabaseClient, {
      event_type: 'test_user_weather_data_create_success',
      status: 'success',
      message: `Test weather data created successfully for user: ${user_id}`,
      user_id: user_id,
      metadata: { testWeather, created_weather: data?.[0] },
    })
    
    return new Response(JSON.stringify({ success: true, weather: data?.[0] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    await safeLogError(supabaseClient, {
      event_type: 'test_user_weather_data_create_exception',
      status: 'error',
      message: err?.message || String(err),
      metadata: { testWeather },
    })
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
}) 