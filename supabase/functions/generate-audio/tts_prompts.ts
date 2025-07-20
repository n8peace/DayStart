// Last Updated: 2024-07-19
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

// Text normalization function for TTS clarity
function normalizeTextForTTS(text: string): string {
  return text
    // Convert monetary values
    .replace(/([$£€¥])(\d+(?:,\d{3})*(?:\.\d{2})?)/g, (match, currency, num) => {
      const numWithoutCommas = num.replace(/,/g, '')
      const currencyMap: { [key: string]: string } = {
        $: 'dollars',
        '£': 'pounds',
        '€': 'euros',
        '¥': 'yen',
      }
      
      if (numWithoutCommas.includes('.')) {
        const [dollars, cents] = numWithoutCommas.split('.')
        const dollarsWords = numberToWords(parseInt(dollars))
        const centsWords = numberToWords(parseInt(cents))
        return `${dollarsWords} ${currencyMap[currency] || 'currency'} and ${centsWords} cents`
      }
      
      const words = numberToWords(parseInt(numWithoutCommas))
      return `${words} ${currencyMap[currency] || 'currency'}`
    })
    
    // Convert phone numbers
    .replace(/(\d{3})-(\d{3})-(\d{4})/g, (match, p1, p2, p3) => {
      return `${spellOutDigits(p1)}, ${spellOutDigits(p2)}, ${spellOutDigits(p3)}`
    })
    
    // Convert percentages
    .replace(/(\d+(?:\.\d+)?)%/g, (match, num) => {
      const words = numberToWords(parseFloat(num))
      return `${words} percent`
    })
    
    // Convert measurements
    .replace(/(\d+(?:\.\d+)?)\s*(km|mi|m|ft|in|cm|mm|kg|lb|oz)/g, (match, num, unit) => {
      const words = numberToWords(parseFloat(num))
      const unitMap: { [key: string]: string } = {
        km: 'kilometers',
        mi: 'miles',
        m: 'meters',
        ft: 'feet',
        in: 'inches',
        cm: 'centimeters',
        mm: 'millimeters',
        kg: 'kilograms',
        lb: 'pounds',
        oz: 'ounces'
      }
      return `${words} ${unitMap[unit] || unit}`
    })
    
    // Convert ordinals
    .replace(/(\d+)(st|nd|rd|th)/g, (match, num, suffix) => {
      const words = numberToWords(parseInt(num))
      return `${words}${suffix}`
    })
    
    // Convert decimals
    .replace(/(\d+)\.(\d+)/g, (match, whole, decimal) => {
      const wholeWords = numberToWords(parseInt(whole))
      const decimalDigits = decimal.split('').map(d => numberToWords(parseInt(d))).join(' ')
      return `${wholeWords} point ${decimalDigits}`
    })
    
    // Convert fractions
    .replace(/(\d+)\/(\d+)/g, (match, num, denom) => {
      const numWords = numberToWords(parseInt(num))
      const denomWords = numberToWords(parseInt(denom))
      return `${numWords} ${denomWords}`
    })
    
    // Convert keyboard shortcuts
    .replace(/Ctrl\s*\+\s*([A-Z])/g, 'control $1')
    .replace(/Cmd\s*\+\s*([A-Z])/g, 'command $1')
    .replace(/Alt\s*\+\s*([A-Z])/g, 'alt $1')
    .replace(/Shift\s*\+\s*([A-Z])/g, 'shift $1')
    
    // Convert URLs
    .replace(/([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)\.([a-zA-Z0-9-]+)/g, (match, domain, tld, path) => {
      return `${domain} dot ${tld} slash ${path}`
    })
    
    // Expand common abbreviations
    .replace(/\bDr\./g, 'Doctor')
    .replace(/\bMr\./g, 'Mister')
    .replace(/\bMrs\./g, 'Missus')
    .replace(/\bMs\./g, 'Miss')
    .replace(/\bAve\./g, 'Avenue')
    .replace(/\bSt\./g, 'Street')
    .replace(/\bRd\./g, 'Road')
    .replace(/\bBlvd\./g, 'Boulevard')
    .replace(/\bLn\./g, 'Lane')
    .replace(/\bApt\./g, 'Apartment')
    .replace(/\bInc\./g, 'Incorporated')
    .replace(/\bCorp\./g, 'Corporation')
    .replace(/\bLtd\./g, 'Limited')
    .replace(/\bCo\./g, 'Company')
    .replace(/\bvs\./g, 'versus')
    .replace(/\betc\./g, 'et cetera')
    .replace(/\bi\.e\./g, 'that is')
    .replace(/\be\.g\./g, 'for example')
    .replace(/\bAM\b/g, 'A M')
    .replace(/\bPM\b/g, 'P M')
    .replace(/\bEST\b/g, 'Eastern Standard Time')
    .replace(/\bPST\b/g, 'Pacific Standard Time')
    .replace(/\bCST\b/g, 'Central Standard Time')
    .replace(/\bMST\b/g, 'Mountain Standard Time')
    .replace(/\bGMT\b/g, 'Greenwich Mean Time')
    .replace(/\bUTC\b/g, 'Coordinated Universal Time')
    
    // Convert standalone numbers (4+ digits)
    .replace(/\b(\d{4,})\b/g, (match, num) => {
      return numberToWords(parseInt(num))
    })
    
    // Convert standalone numbers (1-3 digits) that aren't already converted
    .replace(/\b(\d{1,3})\b/g, (match, num) => {
      // Only convert if it's not part of a larger expression
      return numberToWords(parseInt(num))
    })
}

// Helper function to convert numbers to words
function numberToWords(num: number): string {
  if (num === 0) return 'zero'
  if (num < 0) return `negative ${numberToWords(Math.abs(num))}`
  
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return tens[ten] + (one > 0 ? ` ${ones[one]}` : '')
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100)
    const remainder = num % 100
    return ones[hundred] + ' hundred' + (remainder > 0 ? ` ${numberToWords(remainder)}` : '')
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000)
    const remainder = num % 1000
    return numberToWords(thousand) + ' thousand' + (remainder > 0 ? ` ${numberToWords(remainder)}` : '')
  }
  if (num < 1000000000) {
    const million = Math.floor(num / 1000000)
    const remainder = num % 1000000
    return numberToWords(million) + ' million' + (remainder > 0 ? ` ${numberToWords(remainder)}` : '')
  }
  
  // For very large numbers, just return the original
  return num.toString()
}

// Helper function to spell out individual digits
function spellOutDigits(num: string): string {
  return num
    .split('')
    .map(digit => numberToWords(parseInt(digit)))
    .join(' ')
}

export const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  voice_1: {
    voiceId: 'wdRkW5c5eYi8vKR8E4V9',
    name: 'Grace',
    description: 'Female meditative wake up voice - even slower pacing and gentle tone',
    modelId: 'eleven_multilingual_v2',
    stability: 0.6, // smoother delivery
    similarityBoost: 0.75,
    style: 0.05, // lower for calmer tone
    useSpeakerBoost: true,
    pauseAfterSentences: 1.5 // extended pause for meditation feel
  },
  voice_2: {
    voiceId: 'wBXNqKUATyqu0RtYt25i',
    name: 'Adam',
    description: 'Male drill sergeant voice - amped up like Major Payne, aggressive and commanding',
    modelId: 'eleven_multilingual_v2',
    stability: 0.2, // more vocal unpredictability
    similarityBoost: 0.6,
    style: 0.9, // max assertiveness
    useSpeakerBoost: true,
    pauseAfterSentences: 0.3 // fast pacing
  },
  voice_3: {
    voiceId: 'QczW7rKFMVYyubTC1QDk',
    name: 'Matthew',
    description: 'Male narrative voice - Michael Barbaro style with steady rhythm and journalistic warmth',
    modelId: 'eleven_multilingual_v2',
    stability: 0.6, // more consistent tone
    similarityBoost: 0.8,
    style: 0.1, // calm and neutral
    useSpeakerBoost: true,
    pauseAfterSentences: 1.25 // slightly slower for dramatic effect
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

  // Apply text normalization for TTS clarity
  processedText = normalizeTextForTTS(processedText)

  // Normalize ElevenLabs tags and inject pacing
  const sentences = processedText.split(/(?<=[.?!])\s+/)
  let output: string[] = []

  for (let i = 0; i < sentences.length; i++) {
    let sentence = sentences[i]
    output.push(sentence)

    // Apply pauses based on voice pacing using new ElevenLabs break format
    if (voice === 'voice_1') output.push('<break time="1.5s" />')
    else if (voice === 'voice_2') output.push('<break time="0.5s" />')
    else output.push('<break time="1s" />')
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