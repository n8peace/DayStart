// Last Updated: 2025-01-27
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
  pauseAfterSentences?: number
  defaultBreathFrequency?: number // e.g., insert [take a breath] every N sentences
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

export const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  voice_1: {
    voiceId: 'wdRkW5c5eYi8vKR8E4V9',
    name: 'Grace',
    description: 'Female meditative wake up voice - soft pacing and calm rhythm',
    modelId: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.1,
    useSpeakerBoost: true,
    pauseAfterSentences: 1,
    defaultBreathFrequency: 2
  },
  voice_2: {
    voiceId: 'wBXNqKUATyqu0RtYt25i',
    name: 'Adam',
    description: 'Male drill sergeant voice - high energy and commanding authority',
    modelId: 'eleven_multilingual_v2',
    stability: 0.3,
    similarityBoost: 0.6,
    style: 0.2,
    useSpeakerBoost: true,
    pauseAfterSentences: 1,
    defaultBreathFrequency: 0 // no breath markers
  },
  voice_3: {
    voiceId: 'QczW7rKFMVYyubTC1QDk',
    name: 'Matthew',
    description: 'Male narrative voice - calm, neutral tone and medium pacing',
    modelId: 'eleven_multilingual_v2',
    stability: 0.4,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true,
    pauseAfterSentences: 1,
    defaultBreathFrequency: 3
  }
}

export const DEFAULT_VOICE = 'voice_1'
export const ELEVEN_LABS_API_BASE = 'https://api.elevenlabs.io/v1'
export const ELEVEN_LABS_TIMEOUT_MS = 60000
export const ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT = 5000
export const DEFAULT_OUTPUT_FORMAT = 'aac'

export function preprocessTextForVoice(text: string, voice: string): string {
  const voiceConfig = VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE]

  if (text.length > ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT) {
    console.warn(`Text length (${text.length}) exceeds ElevenLabs limit. Truncating.`)
    text = text.substring(0, ELEVEN_MULTILINGUAL_V2_CHAR_LIMIT)
  }

  let processedText = text
    .replace(/<[^>]*>/g, '')
    .trim()

  // Normalize ElevenLabs tags and inject pacing
  const sentences = processedText.split(/(?<=[.?!])\s+/)
  let output: string[] = []
  let breathCounter = 0

  for (let i = 0; i < sentences.length; i++) {
    let sentence = sentences[i]
    output.push(sentence)

    // Apply pauses based on voice pacing
    if (voice === 'voice_1') output.push('[pause 2s]')
    else if (voice === 'voice_2') output.push('[pause 0.5s]')
    else output.push('[pause 1s]')

    // Inject [take a breath] periodically if applicable
    if (voiceConfig.defaultBreathFrequency && ++breathCounter % voiceConfig.defaultBreathFrequency === 0) {
      output.push('[take a breath]')
    }
  }

  return output.join(' ').replace(/\s+/g, ' ').trim()
}

export function isValidVoice(voice: string): voice is keyof typeof VOICE_CONFIGS {
  return voice in VOICE_CONFIGS
}

export function getVoiceConfig(voice: string): VoiceConfig {
  return VOICE_CONFIGS[voice] || VOICE_CONFIGS[DEFAULT_VOICE]
}

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