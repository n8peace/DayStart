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

  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Generate test user data
  const testEmail = `testuser_${Date.now()}@example.com`
  const testUser = {
    email: testEmail,
    phone: null,
    onboarding_status: 'pending',
    subscription_status: 'free',
    is_admin: false,
    last_login: null,
  }

  try {
    const { data, error } = await supabaseClient.from('users').insert([testUser]).select()
    if (error) {
      await safeLogError(supabaseClient, {
        event_type: 'test_user_create_failed',
        status: 'error',
        message: error.message,
        metadata: { testUser },
      })
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    return new Response(JSON.stringify({ success: true, user: data?.[0] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    await safeLogError(supabaseClient, {
      event_type: 'test_user_create_exception',
      status: 'error',
      message: err?.message || String(err),
      metadata: { testUser },
    })
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
}) 