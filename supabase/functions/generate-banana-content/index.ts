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
  dayOfWeek: string
  date: string
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
      script_generated_at: new Date().toISOString(),
      status: ContentBlockStatus.SCRIPT_GENERATED,
      voice: userData.voice,
      content_priority: 1,
      expiration_date: expirationDateStr,
      language_code: 'en-US',
      content: JSON.stringify({
        user_name: userData.name,
        city: userData.city,
        state: userData.state,
        weather: userData.weather,
        headlines: userData.headlines,
        markets: userData.markets,
        day_of_week: userData.dayOfWeek,
        date: userData.date
      }),
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

  // Get weather data using user's zipcode
  const { data: weatherData, error: weatherError } = await supabaseClient
    .from('user_weather_data')
    .select('*')
    .eq('location_key', userPrefs.location_zip)
    .eq('date', date)
    .not('expires_at', 'lt', new Date().toISOString())
    .single()

  if (weatherError || !weatherData) {
    throw new Error(`Failed to fetch weather data: ${weatherError?.message || 'No weather data found'}`)
  }

  // Get most recent headlines content block
  const { data: headlinesData, error: headlinesError } = await supabaseClient
    .from('content_blocks')
    .select('content, parameters')
    .eq('content_type', 'headlines')
    .in('status', [ContentBlockStatus.READY, ContentBlockStatus.CONTENT_READY])
    .order('created_at', { ascending: false })
    .limit(1)

  if (headlinesError || !headlinesData || headlinesData.length === 0) {
    throw new Error(`Failed to fetch headlines: ${headlinesError?.message || 'No headlines found'}`)
  }

  // Get most recent markets content block
  const { data: marketsData, error: marketsError } = await supabaseClient
    .from('content_blocks')
    .select('content, parameters')
    .eq('content_type', 'markets')
    .in('status', [ContentBlockStatus.READY, ContentBlockStatus.CONTENT_READY])
    .order('created_at', { ascending: false })
    .limit(1)

  if (marketsError || !marketsData || marketsData.length === 0) {
    throw new Error(`Failed to fetch market data: ${marketsError?.message || 'No market data found'}`)
  }

  // Extract headlines and markets from existing content blocks
  const headlines = extractHeadlinesFromContent(headlinesData[0])
  const markets = extractMarketsFromContent(marketsData[0])

  // Parse weather data from JSONB structure
  const weatherInfo = weatherData.weather_data
  const location = weatherInfo.location || {}
  const current = weatherInfo.current || {}
  const forecast = weatherInfo.forecast || {}

  // Get day of week and date for the current date
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
  
  return {
    name: userPrefs.name || 'there',
    city: userPrefs.city || location.city || 'your area',
    state: userPrefs.state || location.state || '',
    voice: userPrefs.voice || 'voice_1',
    dayOfWeek: dayOfWeek,
    date: date,
    weather: {
      temperature: current.temperature || forecast.high || 70,
      condition: current.condition || 'Unknown',
      humidity: current.humidity || 50,
      wind_speed: current.wind_speed || 5,
      description: `${current.condition || 'Unknown'} with a high of ${forecast.high || 'N/A'}°F and low of ${forecast.low || 'N/A'}°F`
    },
    headlines: headlines,
    markets: markets
  }
}

function extractHeadlinesFromContent(contentBlock: any): HeadlineData {
  // Try to extract from parameters first (more structured data)
  if (contentBlock.parameters) {
    const params = contentBlock.parameters
    
    // Check if we have categorized headlines in parameters
    if (params.business_headlines && params.political_headlines && params.entertainment_headlines) {
      return {
        business: params.business_headlines[0] || 'Business news is brewing',
        political: params.political_headlines[0] || 'Politics are heating up',
        popCulture: params.entertainment_headlines[0] || 'Entertainment is buzzing'
      }
    }
    
    // Check for other parameter structures
    if (params.top_headlines && Array.isArray(params.top_headlines)) {
      const headlines = params.top_headlines
      return {
        business: headlines.find(h => h.toLowerCase().includes('business') || h.toLowerCase().includes('market')) || 'Business news is brewing',
        political: headlines.find(h => h.toLowerCase().includes('politic') || h.toLowerCase().includes('government')) || 'Politics are heating up',
        popCulture: headlines.find(h => h.toLowerCase().includes('entertainment') || h.toLowerCase().includes('celebrity')) || 'Entertainment is buzzing'
      }
    }
  }
  
  // Fallback to parsing content text
  const lines = contentBlock.content.split('\n').filter(line => line.trim())
  
  return {
    business: lines.find(line => line.toLowerCase().includes('business') || line.toLowerCase().includes('market')) || 'Business news is brewing',
    political: lines.find(line => line.toLowerCase().includes('politic') || line.toLowerCase().includes('government')) || 'Politics are heating up',
    popCulture: lines.find(line => line.toLowerCase().includes('entertainment') || line.toLowerCase().includes('celebrity')) || 'Entertainment is buzzing'
  }
}

function extractMarketsFromContent(contentBlock: any): MarketData {
  // Try to extract from parameters first (more structured data)
  if (contentBlock.parameters) {
    const params = contentBlock.parameters
    
    // Check for market summary in parameters
    if (params.market_summary) {
      return {
        summary: params.market_summary,
        trend: params.market_trend || 'trending',
        keyMovers: params.key_movers || params.top_movers || []
      }
    }
    
    // Check for other parameter structures
    if (params.overall_trend) {
      return {
        summary: params.summary || 'Markets are moving',
        trend: params.overall_trend,
        keyMovers: params.movers || []
      }
    }
  }
  
  // Fallback to parsing content text
  const lines = contentBlock.content.split('\n').filter(line => line.trim())
  
  return {
    summary: lines[0] || 'Markets are moving',
    trend: lines.find(line => line.toLowerCase().includes('up') || line.toLowerCase().includes('down')) || 'trending',
    keyMovers: lines.filter(line => line.includes('%') || line.includes('$')).slice(0, 3)
  }
}

async function generateBananaScript(userData: UserData): Promise<string> {
  const voicePrompt = getVoiceSpecificPrompt(userData.voice)
  
  const prompt = `You are a hilarious morning wake-up script writer. Create a 90-120 second funny morning wake-up script for Eleven Labs voice generation.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[userData.voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}

${FORMATTING_RESTRICTIONS}

User Information:
- Name: ${userData.name}
- Location: ${userData.city}, ${userData.state}
- Voice: ${userData.voice}
- Date: ${userData.dayOfWeek}, ${userData.date}

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
1. Start with "It's ${userData.dayOfWeek}, [date without year]." (e.g., "It's Monday, July twenty-first.")
2. Make it funny and engaging while maintaining the voice style
3. Include the user's name naturally
4. Reference the weather in a humorous way
5. Mention one or two headlines in a funny context
6. Include a brief market reference
7. Keep it between 90-120 seconds when spoken
8. Use ElevenLabs break tags to control pacing:
   - Use <break time="1s" /> between thoughts
   - Use <break time="2s" /> for emphasis
   - Use <break time="0.5s" /> for quick transitions
9. Make it feel personal and conversational
10. Use voice-specific phrasing: openings like "${VOICE_PHRASE_LIB[userData.voice]?.openers[0] || 'Good morning'}" and transitions like "${VOICE_PHRASE_LIB[userData.voice]?.transitions[0] || 'Now'}"
11. Format all numbers, dates, and abbreviations for speech synthesis
12. Avoid metaphors, sentimentality, or poetic flourishes

${NO_FLUFF_INSTRUCTION}

${TTS_FORMATTING_INSTRUCTION}

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
            content: `You are a professional script writer specializing in funny, engaging morning wake-up content for Eleven Labs voice generation. Your role is to create personalized, humorous scripts that help users start their day with energy and positivity.

Key Responsibilities:
- Create 90-120 second scripts optimized for speech synthesis
- Maintain voice-specific tone and pacing
- Include personalized content (weather, headlines, markets)
- Use proper Eleven Labs formatting and break tags
- Ensure all text is optimized for natural speech output

Voice Style: ${VOICE_INSTRUCTIONS[userData.voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}

${FORMATTING_RESTRICTIONS}`
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

// Voice-specific instructions from generate-script prompts.ts
const VOICE_INSTRUCTIONS = {
  voice_1: `Speak as a meditative morning guide. Use short, calm phrases with natural rhythm. Favor gentle, grounded language that invites presence without sounding poetic. Insert <break time="1.5s" /> or <break time="2s" /> between complete ideas to allow for reflection. Avoid complex or dramatic metaphors — instead, focus on clarity, calm, and a steady emotional cadence. You are offering quiet confidence and peace. Examples: "You're here. This moment matters." or "Take one breath. Then another."`,

  voice_2: `Speak like a no-nonsense drill sergeant. Every sentence is a command. Your voice is sharp, fast, and loud — but never comical. Never apologize. Never ask. Never explain. You give orders. Use clipped sentences and barked phrases. Avoid transitions. Keep momentum high.

Use action verbs: Get. Move. Push. Own. Crush. Do not say things like "maybe," "try," or "consider." You don't motivate — you command.

Insert <break time="0.4s" /> after each command or thought to maintain rapid-fire rhythm. Be relentless. Be exact.

Examples: 
- "WAKE UP! Feet. Floor. Now." 
- "You've got 30 minutes. Don't waste a second."
- "No coffee until that checklist is DONE."

Do NOT:
- Use inspirational fluff.
- Ask rhetorical questions.
- Use casual language or jokes.
- Ever use the word 'let's' or 'maybe'.

You're not a coach. You're not a friend. You are the force that gets them out of bed — whether they like it or not.`,

  voice_3: `Speak like a steady, trusted narrator. Warm, clear, and conversational — like a podcast host or NPR journalist. Use short to medium-length sentences with slight pacing variation. Insert <break time="1s" /> between meaningful thoughts to give listeners space to process. Avoid embellishment or dramatic flair. You are friendly, confident, and informed. Examples: "It's Tuesday. Here's what to expect today." or "Let's take a minute to think about where you're heading."`
}

// Voice-specific phrase library
const VOICE_PHRASE_LIB: Record<string, { openers: string[]; transitions: string[] }> = {
  voice_1: {
    openers: [
      "Take a deep breath.",
      "Let's begin this morning together.",
      "Welcome to a new day."
    ],
    transitions: [
      "Now, gently shift your attention...",
      "Let's pause for a moment...",
      "As you continue, notice your breath..."
    ]
  },
  voice_2: {
    openers: [
      "Up. Now.",
      "Let's get moving.",
      "No excuses. Let's go."
    ],
    transitions: [
      "Next. Move.",
      "Don't stop.",
      "Keep going."
    ]
  },
  voice_3: {
    openers: [
      "It's ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.",
      "Here's what's ahead today.",
      "Let's take a look at your morning."
    ],
    transitions: [
      "Meanwhile...",
      "In other news...",
      "Let's shift gears."
    ]
  }
}

// Eleven Labs formatting restrictions
const FORMATTING_RESTRICTIONS = `
CRITICAL FORMATTING RULES:
- NEVER include background music references like "[soft ambient music begins]", "[music fades]", or any music-related text
- NEVER use emojis in the response
- Write only the spoken content that will be converted to audio
- Do not include stage directions, sound effects, or production notes (except supported tags like <break time="1s" />)
- Focus purely on the verbal content that ElevenLabs will speak
- DO NOT use nicknames, titles, or poetic phrases like "dear listener," "gentle giant," or "dance of the numbers."
- DO NOT editorialize or anthropomorphize (e.g., "the S&P 500 took a nap").
- Be concise, factual, and grounded. Think like NPR, BBC, or NYT Headlines.
- Eliminate filler words or overly inspirational openings. Start with substance.
- Use ElevenLabs supported break tags like <break time="1s" /> to control rhythm and energy.
- Never say "no significant holidays today." If there is no holiday, omit this section.
- Never say "data is unavailable" or "check back later."
- If data is missing, focus on what you can. If there's insufficient data, reply back with an error code.
- Skip filler or apology phrases when data is incomplete.

TEXT-TO-SPEECH NORMALIZATION RULES:
- Expand all numbers to their spoken form: "1234" → "one thousand two hundred thirty-four"
- Convert currency: "$42.50" → "forty-two dollars and fifty cents"
- Expand abbreviations: "Dr." → "Doctor", "Ave." → "Avenue", "St." → "Street"
- Spell out phone numbers: "555-555-5555" → "five five five, five five five, five five five five"
- Convert percentages: "100%" → "one hundred percent"
- Expand dates: "2024-01-01" → "January first, two thousand twenty-four"
- Convert time: "14:30" → "two thirty PM"
- Spell out measurements: "100km" → "one hundred kilometers"
- Expand ordinals: "2nd" → "second", "3rd" → "third"
- Convert decimals: "3.14" → "three point one four"
- Expand fractions: "⅔" → "two-thirds"
- Convert keyboard shortcuts: "Ctrl + Z" → "control z"
- Expand URLs: "elevenlabs.io/docs" → "eleven labs dot io slash docs"`

// Anti-fluff directive
const NO_FLUFF_INSTRUCTION = `IMPORTANT: Strip all metaphors, sentimentality, or poetic flourishes. Avoid personification or editorial commentary. Keep tone clear, neutral, and matter-of-fact. Use <break> tags to reinforce tone.`

// TTS formatting directive
const TTS_FORMATTING_INSTRUCTION = `CRITICAL: Format all text for optimal speech synthesis. Expand numbers, abbreviations, and symbols to their spoken form. For example: "1234" should be "one thousand two hundred thirty-four", "$42.50" should be "forty-two dollars and fifty cents", "Dr." should be "Doctor". This ensures clear, natural speech output.`

function getVoiceSpecificPrompt(voice: string): string {
  return VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3
} 