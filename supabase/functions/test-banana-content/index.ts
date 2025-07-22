// Last Updated: 2025-01-17
// Example request body:
// {
//   "user_id": "123e4567-e89b-12d3-a456-426614174000"
// }
// Note: This function can also be called with GET for testing
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError } from '../shared/utils.ts'

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

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // Get a test user
    const { data: users, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .limit(1)

    if (userError || !users || users.length === 0) {
      return new Response(JSON.stringify({ error: 'No test users found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const testUserId = users[0].id

    // Check if user has required data
    const { data: userPrefs, error: prefsError } = await supabaseClient
      .from('user_preferences')
      .select('*')
      .eq('user_id', testUserId)
      .single()

    if (prefsError || !userPrefs) {
      return new Response(JSON.stringify({ 
        error: 'Test user missing preferences',
        user_id: testUserId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Check if required content exists
    const today = new Date().toISOString().split('T')[0]
    
    const { data: headlinesData, error: headlinesError } = await supabaseClient
      .from('content_blocks')
      .select('id')
      .eq('content_type', 'headlines')
      .eq('date', today)
      .in('status', ['ready', 'content_ready'])
      .limit(1)

    const { data: marketsData, error: marketsError } = await supabaseClient
      .from('content_blocks')
      .select('id')
      .eq('content_type', 'markets')
      .eq('date', today)
      .in('status', ['ready', 'content_ready'])
      .limit(1)

    const { data: weatherData, error: weatherError } = await supabaseClient
      .from('user_weather_data')
      .select('id')
      .eq('user_id', testUserId)
      .eq('date', today)
      .not('expires_at', 'lt', new Date().toISOString())
      .limit(1)

    const missingData = []
    if (headlinesError || !headlinesData || headlinesData.length === 0) {
      missingData.push('headlines')
    }
    if (marketsError || !marketsData || marketsData.length === 0) {
      missingData.push('markets')
    }
    if (weatherError || !weatherData || weatherData.length === 0) {
      missingData.push('weather')
    }

    if (missingData.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Missing required data: ${missingData.join(', ')}`,
        user_id: testUserId,
        missing_data: missingData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Call the banana content function
    const bananaResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-banana-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: testUserId })
    })

    const bananaResult = await bananaResponse.json()

    // Log test result
    await safeLogError(supabaseClient, {
      event_type: 'test_banana_content',
      status: bananaResponse.ok ? 'success' : 'error',
      message: `Banana content test for user ${testUserId}`,
      user_id: testUserId,
      metadata: { 
        banana_response: bananaResult,
        user_preferences: userPrefs,
        has_headlines: headlinesData && headlinesData.length > 0,
        has_markets: marketsData && marketsData.length > 0,
        has_weather: weatherData && weatherData.length > 0
      },
    })

    return new Response(JSON.stringify({ 
      success: bananaResponse.ok,
      user_id: testUserId,
      banana_result: bananaResult,
      user_preferences: userPrefs
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    await safeLogError(supabaseClient, {
      event_type: 'test_banana_content_exception',
      status: 'error',
      message: err?.message || String(err),
      metadata: { error: err?.toString() },
    })
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
}) 