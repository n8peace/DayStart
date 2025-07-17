// Shared TypeScript interfaces for DayStart Edge Functions

export interface ContentBlock {
  id: string;
  user_id?: string;
  content_type: string;
  date: string;
  content?: string;
  script?: string;
  audio_url?: string;
  status: string;
  voice?: string;
  duration_seconds?: number;
  audio_duration?: number;
  retry_count: number;
  content_priority: number;
  expiration_date: string;
  language_code: string;
  parameters?: any;
  created_at: string;
  updated_at: string;
  script_generated_at?: string;
  audio_generated_at?: string;
}

export interface LogEntry {
  event_type: string;
  status: string;
  message: string;
  metadata?: any;
  content_block_id?: string;
  user_id?: string;
}

// Add other shared types as needed 