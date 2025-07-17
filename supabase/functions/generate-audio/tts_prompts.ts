// ElevenLabs TTS Configuration for DayStart Audio Generation
// This file contains voice mappings, model settings, and TTS-specific prompts

export interface VoiceConfig {
  voiceId: string
  name: string
  description: string
  modelId: string
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
}

export interface TTSRequest {
  text: string
  model_id: string
  output_format?: string
  voice_settings: {
    stability: number
    similarity_boost: number
    style: number
    use_speaker_boost: boolean
  }
}

// ElevenLabs Voice Mappings
// Using Eleven Multilingual v2 model: High-quality multilingual speech synthesis
// - 29+ languages supported
// - 5,000 character limit
// - Natural speech with good emotion control
// - Support for multiple languages in single request
export const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  voice_1: {
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Grace - female meditative wake up voice
    name: 'Grace',
    description: 'Female meditative wake up voice - soft pacing and calm rhythm',
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  },
  voice_2: {
    voiceId: 'pFZP5JQG7iQjIQuC4Bku', // Adam - male drill sergeant voice
    name: 'Adam', 
    description: 'Male drill sergeant voice - high energy and commanding authority',
    modelId: 'eleven_multilingual_v2',
    stability: 0.3,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  },
  voice_3: {
    voiceId: 'VR6AewLTigWG4xSOukaG', // Matthew - male narrative voice
    name: 'Matthew',
    description: 'Male narrative voice - calm, neutral tone and medium pacing',
    modelId: 'eleven_multilingual_v2',
    stability: 0.4,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  }
}

// Default voice if none specified
export const DEFAULT_VOICE = 'voice_3'

// ElevenLabs API Configuration
export const ELEVEN_LABS_API_BASE = 'https://api.elevenlabs.io/v1'
export const ELEVEN_LABS_TIMEOUT_MS = 60000 // 60 seconds for audio generation
export const ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT = 5000 // Eleven Multilingual v2 character limit
export const DEFAULT_OUTPUT_FORMAT = 'aac' // Default audio format

// Voice-specific text preprocessing
export function preprocessTextForVoice(text: string, voice: string): string {
  const voiceConfig = VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE]
  
  // Check character limit for Eleven Multilingual v2
  if (text.length > ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT) {
    console.warn(`Text length (${text.length}) exceeds Eleven Multilingual v2 limit (${ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT}). Truncating.`)
    text = text.substring(0, ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT)
  }
  
  // Remove any unsupported SSML tags that might have been added
  let processedText = text
    .replace(/<[^>]*>/g, '') // Remove any HTML/XML tags
    .replace(/\[pause\s+\d+s?\]/gi, '') // Remove pause tags (ElevenLabs handles pauses differently)
    .replace(/\[take\s+a\s+breath\]/gi, '') // Remove breath tags
    .trim()
  
  // Add natural pauses for voice-specific pacing
  switch (voice) {
    case 'voice_1': // Grace - meditative
      // Add longer pauses for meditative pacing
      processedText = processedText.replace(/\./g, '... ')
      processedText = processedText.replace(/,/g, ', ')
      break
      
    case 'voice_2': // Adam - drill sergeant
      // Shorter, more direct pacing
      processedText = processedText.replace(/\./g, '. ')
      break
      
    case 'voice_3': // Matthew - narrative
    default:
      // Standard narrative pacing
      processedText = processedText.replace(/\./g, '. ')
      processedText = processedText.replace(/,/g, ', ')
      break
  }
  
  return processedText
}

// Validate voice configuration
export function isValidVoice(voice: string): voice is keyof typeof VOICE_CONFIGS {
  return voice in VOICE_CONFIGS
}

// Get voice configuration
export function getVoiceConfig(voice: string): VoiceConfig {
  return VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE]
}

// Build TTS request payload
export function buildTTSRequest(text: string, voice: string): TTSRequest {
  const voiceConfig = getVoiceConfig(voice)
  const processedText = preprocessTextForVoice(text, voice)
  
  return {
    text: processedText,
    model_id: voiceConfig.modelId,
    output_format: DEFAULT_OUTPUT_FORMAT,
    voice_settings: {
      stability: voiceConfig.stability,
      similarity_boost: voiceConfig.similarityBoost,
      style: voiceConfig.style,
      use_speaker_boost: voiceConfig.useSpeakerBoost
    }
  }
} 