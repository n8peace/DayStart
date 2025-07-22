// Last Updated: 2025-01-17
// Example request body:
// {
//   "user_id": "123e4567-e89b-12d3-a456-426614174000"
// }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ContentBlock, LogEntry, UserPreferences } from '../shared/types.ts'
import { corsHeaders } from '../shared/config.ts'
import { safeLogError, utcDate } from '../shared/utils.ts'
import { validateEnvVars, validateObjectShape } from '../shared/validation.ts'
import { ContentBlockStatus } from '../shared/status.ts'

// Interfaces for data gathering
interface WeatherData {
  temperature: number
  condition: string
  humidity: number
  wind_speed: number
  description: string
}

interface HeadlineData {
  business: string
  political: string
  popCulture: string
}

interface MarketData {
  summary: string
  trend: string
  keyMovers: string[]
}

interface UserData {
  name: string
  city: string
  state: string
  voice: string
  weather: WeatherData
  headlines: HeadlineData
  markets: MarketData
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle health check requests
  const url = new URL(req.url)
  if (req.method === 'GET' || url.pathname === '/health' || url.pathname.endsWith('/health')) {
    try {
      const response = {
        status: 'healthy',
        function: 'generate-banana-content',
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
          function: 'generate-banana-content',
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
    'OPENAI_API_KEY'
  ])

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const requestBody = await req.json()
    const { user_id } = requestBody

    if (!user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'user_id is required' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(user_id)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid UUID format for user_id' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Return immediate success response
    const response = {
      success: true,
      message: 'Banana content generation started',
      user_id: user_id
    }

    // Start async processing
    processBananaContent(supabaseClient, user_id).catch(async (error) => {
      console.error('Banana content generation failed:', error)
      await safeLogError(supabaseClient, {
        event_type: 'banana_content_generation_failed',
        status: 'error',
        message: `Failed to generate banana content: ${error.message}`,
        user_id: user_id,
        metadata: { error: error.toString() }
      })
    })

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Banana content function error:', error)
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

async function processBananaContent(supabaseClient: any, userId: string): Promise<void> {
  const utcDateStr = utcDate()
  const expirationDate = new Date(utcDateStr)
  expirationDate.setHours(expirationDate.getHours() + 72)
  const expirationDateStr = expirationDate.toISOString().split('T')[0]

  try {
    // Step 1: Gather all required data
    const userData = await gatherUserData(supabaseClient, userId, utcDateStr)
    
    // Step 2: Generate script using GPT-4o
    const script = await generateBananaScript(userData)
    
    // Step 3: Create content block
    const contentBlock: Partial<ContentBlock> = {
      user_id: userId,
      content_type: 'banana',
      date: utcDateStr,
      script: script,
      status: ContentBlockStatus.SCRIPT_GENERATED,
      voice: userData.voice,
      content_priority: 1,
      expiration_date: expirationDateStr,
      language_code: 'en-US',
      parameters: {
        user_name: userData.name,
        city: userData.city,
        state: userData.state,
        weather: userData.weather,
        headlines: userData.headlines,
        markets: userData.markets
      }
    }

    const { data, error } = await supabaseClient
      .from('content_blocks')
      .insert(contentBlock)
      .select()
      .single()

    if (error) {
      throw error
    }

    await safeLogError(supabaseClient, {
      event_type: 'banana_content_generated',
      status: 'success',
      message: 'Banana content generated successfully',
      content_block_id: data.id,
      user_id: userId,
      metadata: { 
        content_type: 'banana',
        date: utcDateStr,
        voice: userData.voice
      }
    })

  } catch (error) {
    console.error('Error in processBananaContent:', error)
    throw error
  }
}

async function gatherUserData(supabaseClient: any, userId: string, date: string): Promise<UserData> {
  // Get user preferences
  const { data: userPrefs, error: prefsError } = await supabaseClient
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (prefsError || !userPrefs) {
    throw new Error(`Failed to fetch user preferences: ${prefsError?.message || 'No preferences found'}`)
  }

  // Get weather data
  const { data: weatherData, error: weatherError } = await supabaseClient
    .from('user_weather_data')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .not('expires_at', 'lt', new Date().toISOString())
    .single()

  if (weatherError || !weatherData) {
    throw new Error(`Failed to fetch weather data: ${weatherError?.message || 'No weather data found'}`)
  }

  // Get headlines (business, political, pop culture)
  const { data: headlinesData, error: headlinesError } = await supabaseClient
    .from('content_blocks')
    .select('content')
    .eq('content_type', 'headlines')
    .eq('date', date)
    .in('status', [ContentBlockStatus.READY, ContentBlockStatus.CONTENT_READY])
    .single()

  if (headlinesError || !headlinesData) {
    throw new Error(`Failed to fetch headlines: ${headlinesError?.message || 'No headlines found'}`)
  }

  // Get market data
  const { data: marketsData, error: marketsError } = await supabaseClient
    .from('content_blocks')
    .select('content')
    .eq('content_type', 'markets')
    .eq('date', date)
    .in('status', [ContentBlockStatus.READY, ContentBlockStatus.CONTENT_READY])
    .single()

  if (marketsError || !marketsData) {
    throw new Error(`Failed to fetch market data: ${marketsError?.message || 'No market data found'}`)
  }

  // Parse headlines to extract business, political, and pop culture
  const headlines = parseHeadlines(headlinesData.content)
  const markets = parseMarkets(marketsData.content)

  return {
    name: userPrefs.name || 'there',
    city: userPrefs.city || 'your area',
    state: userPrefs.state || '',
    voice: userPrefs.voice || 'voice_1',
    weather: {
      temperature: weatherData.temperature,
      condition: weatherData.condition,
      humidity: weatherData.humidity,
      wind_speed: weatherData.wind_speed,
      description: weatherData.description
    },
    headlines: headlines,
    markets: markets
  }
}

function parseHeadlines(content: string): HeadlineData {
  // Simple parsing - in a real implementation, you might want more sophisticated parsing
  const lines = content.split('\n').filter(line => line.trim())
  
  return {
    business: lines.find(line => line.toLowerCase().includes('business') || line.toLowerCase().includes('market')) || 'Business news is brewing',
    political: lines.find(line => line.toLowerCase().includes('politic') || line.toLowerCase().includes('government')) || 'Politics are heating up',
    popCulture: lines.find(line => line.toLowerCase().includes('entertainment') || line.toLowerCase().includes('celebrity')) || 'Entertainment is buzzing'
  }
}

function parseMarkets(content: string): MarketData {
  // Simple parsing - extract key information
  const lines = content.split('\n').filter(line => line.trim())
  
  return {
    summary: lines[0] || 'Markets are moving',
    trend: lines.find(line => line.toLowerCase().includes('up') || line.toLowerCase().includes('down')) || 'trending',
    keyMovers: lines.filter(line => line.includes('%') || line.includes('$')).slice(0, 3)
  }
}

async function generateBananaScript(userData: UserData): Promise<string> {
  const voicePrompt = getVoiceSpecificPrompt(userData.voice)
  
  const prompt = `You are a hilarious morning wake-up script writer. Create a 90-120 second funny morning wake-up script for Eleven Labs voice generation.

${voicePrompt}

User Information:
- Name: ${userData.name}
- Location: ${userData.city}, ${userData.state}
- Voice: ${userData.voice}

Current Weather:
- Temperature: ${userData.weather.temperature}°F
- Condition: ${userData.weather.condition}
- Description: ${userData.weather.description}

Today's Headlines:
- Business: ${userData.headlines.business}
- Political: ${userData.headlines.political}
- Pop Culture: ${userData.headlines.popCulture}

Market Summary:
${userData.markets.summary}

Requirements:
1. Make it funny and engaging
2. Include the user's name naturally
3. Reference the weather in a humorous way
4. Mention one or two headlines in a funny context
5. Include a brief market reference
6. Keep it between 90-120 seconds when spoken
7. Use natural speech patterns with pauses and emphasis
8. Make it feel personal and conversational

Write only the script text, no additional formatting or instructions.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a professional script writer specializing in funny, engaging morning wake-up content. Write in a conversational, natural speaking style.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content.trim()

  } catch (error) {
    throw new Error(`Failed to generate script: ${error.message}`)
  }
}

function getVoiceSpecificPrompt(voice: string): string {
  switch (voice) {
    case 'voice_1':
      return 'Voice Style: Female, meditative, calm, and soothing. Write in a gentle, encouraging tone that feels like a caring friend or mentor.'
    case 'voice_2':
      return 'Voice Style: Male, drill sergeant, energetic, and commanding. Write in a bold, motivational tone with lots of energy and enthusiasm.'
    case 'voice_3':
      return 'Voice Style: Male, narrative, warm, and conversational. Write in a friendly, storytelling tone that feels like a trusted friend sharing news.'
    default:
      return 'Voice Style: Friendly and conversational. Write in a warm, engaging tone.'
  }
} 