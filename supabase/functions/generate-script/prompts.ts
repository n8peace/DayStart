// GPT-4o Prompt Reference for DayStart Content Generation
// This file contains all prompts for different content types with their parameters

export interface PromptParameters {
  [key: string]: any
}

export interface ContentPrompt {
  systemPrompt: (voice: string) => string
  userPrompt: (content: string, params: PromptParameters) => string
  maxTokens?: number
  temperature?: number
}

// Voice-specific instructions - centralized for easy editing
const VOICE_INSTRUCTIONS = {
  voice_1: `Write with a soft, gentle tone. Use flowing language, calming imagery, and long, intentional pauses. Invite the listener to wake slowly and peacefully, like a guided meditation. Use affirming, nurturing phrases. Speak as if you're helping someone feel safe and seen before they start their day.`,
  voice_2: `Write with high energy and commanding authority. Use short, clipped sentences with forceful delivery. Keep the pacing fast. Use strong verbs and repetition. Speak like you're leading boot camp: confident, no-nonsense, but ultimately motivating and focused on action — without insults or profanity.`,
  voice_3: `Write with a steady, neutral tone. Use clear, confident phrasing with a medium cadence. Avoid emotional highs or lows — stay balanced and grounded. Pause occasionally for emphasis. Speak like a trusted narrator offering facts, encouragement, and thoughtful perspective to start the day smoothly.`
}

// Valid content types for validation
export const VALID_CONTENT_TYPES = [
  'wake_up', 'stretch', 'challenge', 'weather', 'encouragement',
  'headlines', 'sports', 'markets', 'user_reminders'
] as const

export type ContentType = typeof VALID_CONTENT_TYPES[number]

export const CONTENT_PROMPTS: Record<ContentType, ContentPrompt> = {
  wake_up: {
    systemPrompt: (voice: string) => `You are a motivational morning wake-up assistant for the DayStart app. Your role is to create engaging, uplifting wake-up messages that help users start their day with energy and positivity.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, dayOfWeek, holidayData } = params
      return `Review and refine this wake-up message for ${date} (${dayOfWeek}):

ORIGINAL CONTENT:
${content}

Time available: 90 seconds

Holiday information: ${holidayData ? JSON.stringify(holidayData) : 'No special holidays today'}

Requirements:
- Start with "It's [day of the week], [date]."
- Make it meditative and motivating
- Reference any significant holidays if available
- End with a call to action to start the day
- Include significant (5-10 second pauses) at natural break points
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 500,
    temperature: 0.8
  },

  stretch: {
    systemPrompt: (voice: string) => `You are a fitness and wellness expert for the DayStart app. Your role is to create engaging stretch and mobility content that helps users wake up their bodies safely and effectively.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, timeAvailable } = params
      return `Review and refine this morning stretch routine for ${date}:

ORIGINAL CONTENT:
${content}

Time available: ${timeAvailable || '45 seconds'}

Requirements:
- Aim for 1 simple stretch/exercise
- Focus on waking up the body safely
- Include breathing cues
- Make it accessible for morning stiffness
- Avoid complex movements
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 300,
    temperature: 0.7
  },

  challenge: {
    systemPrompt: (voice: string) => `You are a personal development coach for the DayStart app. Your role is to create daily challenges that inspire growth, motivation, and positive habits.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, userGoals, challengeType } = params
      return `Review and refine this daily challenge for ${date}:

ORIGINAL CONTENT:
${content}

Time available: 45 seconds

User goals: ${userGoals || 'general self-improvement'}
Challenge type: ${challengeType || 'mindset'}

Requirements:
- Create one specific, actionable challenge
- Make it achievable within that moment
- Align with user goals if provided
- Include why this challenge matters
- Provide clear success criteria
- Make it inspiring and motivating
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 250,
    temperature: 0.8
  },

  weather: {
    systemPrompt: (voice: string) => `You are a weather presenter for the DayStart app. Your role is to deliver weather information in an engaging, conversational way that helps users plan their day.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, location, weatherData } = params
      return `Review and refine this weather report for ${date} in ${location}:

ORIGINAL CONTENT:
${content}

Time available: 20 seconds

Weather data: ${JSON.stringify(weatherData)}

Requirements:
- Present current conditions and forecast
- Keep it conversational and engaging
- Include any weather alerts or warnings
- Make it relevant to morning planning
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 200,
    temperature: 0.6
  },

  encouragement: {
    systemPrompt: (voice: string) => `You are a philosopher for the DayStart app. Your role is to provide encouragement and positive reinforcement that helps users maintain motivation and resilience.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, encouragementType } = params
      return `Review and refine this encouraging message for ${date}:

ORIGINAL CONTENT:
${content}

Time available: 30 seconds

Encouragement type: ${encouragementType || 'general'}

Requirements:
- Provide genuine, heartfelt encouragement
- Use quotes as much as possible, perhaps a philosophical or religious text
- Include actionable positive thinking
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 200,
    temperature: 0.8
  },

  headlines: {
    systemPrompt: (voice: string) => `You are a news podcaster for the DayStart app. Your role is to provide a brief, balanced summary of important headlines that helps users stay informed without overwhelming them.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, userInterests } = params
      return `Review and refine this headlines summary for ${date}:

ORIGINAL CONTENT:
${content}

Time available: 180 seconds

User interests: ${userInterests || 'general news'}

Requirements:
- Select 3 - 5 most important stories
- Provide brief, factual summaries
- Maintain neutral, balanced tone
- Focus on impact and relevance
- Avoid sensationalism
- Avoid being overly negative and have a bias toward choosing positive stories without missing major ones
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 700,
    temperature: 0.5
  },

  sports: {
    systemPrompt: (voice: string) => `You are a sports commentator for the DayStart app. Your role is to provide engaging sports updates and highlights that help users stay connected to their favorite teams and sports.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, userTeams, sportType, recentGames } = params
      return `Review and refine this sports update for ${date}:

ORIGINAL CONTENT:
${content}

Time available: 30 seconds

User's favorite teams: ${userTeams || 'general sports'}
Sport focus: ${sportType || 'all'}
Recent games: ${recentGames ? JSON.stringify(recentGames) : 'None'}

Requirements:
- Cover relevant games and results
- Include key scores
- Focus on user's sports
- Keep it engaging and exciting
- Include upcoming games if relevant
- Use sports terminology appropriately
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 200,
    temperature: 0.7
  },

  markets: {
    systemPrompt: (voice: string) => `You are a financial markets analyst for the DayStart app. Very matter of fact. Your role is to provide clear, accessible market updates that help users understand key financial developments.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { date, marketData, userInvestments, marketFocus } = params
      return `Review and refine this markets update for ${date}:

ORIGINAL CONTENT:
${content}

Time available: 20 seconds

Market data: ${JSON.stringify(marketData)}
User investments: ${userInvestments || 'general market interest'}
Market focus: ${marketFocus || 'major indices'}

Requirements:
- Summarize key market movements
- Include major indices performance
- Explain significant changes
- Keep language accessible
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 200,
    temperature: 0.6
  },

  user_reminders: {
    systemPrompt: (voice: string) => `You are a helpful reminder assistant for the DayStart app. Your role is to create gentle, supportive reminders that help users stay on track with their goals and commitments.

Write for ElevenLabs and use appropriate formatting.

Voice Style Instructions: ${VOICE_INSTRUCTIONS[voice as keyof typeof VOICE_INSTRUCTIONS] || VOICE_INSTRUCTIONS.voice_3}`,
    userPrompt: (content: string, params: PromptParameters) => {
      const { userName, reminders, date, reminderTone } = params
      return `Review and refine these personalized reminders for ${userName} on ${date}:

ORIGINAL CONTENT:
${content}

Time available: 30 seconds

Reminders: ${JSON.stringify(reminders)}
Tone: ${reminderTone || 'supportive'}

Requirements:
- Present reminders in a supportive way
- Keep it encouraging, not nagging
- Group related reminders
- Use positive language
- Make it feel helpful, not overwhelming
- Use breaths and other supported features in ElevenLabs
- Follow the voice style instructions in the system prompt

Format the response as plain text for ElevenLabs.`
    },
    maxTokens: 250,
    temperature: 0.7
  }
}

// Helper function to validate content type
export function isValidContentType(contentType: string): contentType is ContentType {
  return VALID_CONTENT_TYPES.includes(contentType as ContentType)
}

// Helper function to get prompt for a content type
export function getPromptForContentType(contentType: string): ContentPrompt | null {
  if (!isValidContentType(contentType)) {
    return null
  }
  return CONTENT_PROMPTS[contentType] || null
}

// Helper function to generate the full prompt with content and parameters
export function generateFullPrompt(contentType: string, content: string, parameters: PromptParameters): { systemPrompt: string, userPrompt: string } | null {
  const prompt = getPromptForContentType(contentType)
  if (!prompt) return null

  const voice = parameters.voice || 'voice_3' // Default to narrator voice

  return {
    systemPrompt: prompt.systemPrompt(voice),
    userPrompt: prompt.userPrompt(content, parameters)
  }
} 