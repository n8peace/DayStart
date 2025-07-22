// Last Updated: 2024-07-20
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

  // Generate test preferences data
  const testPreferences = {
    user_id,
    timezone: 'America/New_York',
    location_zip: '10001',
    voice: 'voice_1',
  }

  try {
    const { data, error } = await supabaseClient.from('user_preferences').insert([testPreferences]).select()
    if (error) {
      await safeLogError(supabaseClient, {
        event_type: 'test_user_preferences_create_failed',
        status: 'error',
        message: error.message,
        metadata: { testPreferences },
      })
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    return new Response(JSON.stringify({ success: true, preferences: data?.[0] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    await safeLogError(supabaseClient, {
      event_type: 'test_user_preferences_create_exception',
      status: 'error',
      message: err?.message || String(err),
      metadata: { testPreferences },
    })
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
}) 