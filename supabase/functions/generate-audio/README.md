# Generate Audio Function

This Supabase Edge Function generates audio from script content using ElevenLabs Text-to-Speech API.

## Overview

The `generate-audio` function processes content blocks that have been successfully script-generated and converts them to audio files. It:

1. Finds content blocks with `script_generated` status
2. Processes up to 5 blocks per batch (matches ElevenLabs concurrency limit)
3. Uses ElevenLabs API to generate audio from scripts
4. Updates content blocks with audio URL, duration, and generation timestamp
5. Moves status from `script_generated` → `audio_generating` → `ready`

## Voice Configuration

The function supports three ElevenLabs voices:

- **voice_1 (Grace)**: Female meditative wake-up voice - soft pacing and calm rhythm
- **voice_2 (Adam)**: Male drill sergeant voice - high energy and commanding authority  
- **voice_3 (Matthew)**: Male narrative voice - calm, neutral tone and medium pacing

## API Endpoint

```
POST /functions/v1/generate-audio
```

### Response Format

```json
{
  "success": true,
  "processed_count": 25,
  "error_count": 0,
  "errors": []
}
```

## Environment Variables

Required environment variables:

- `ELEVEN_LABS_API_KEY`: Your ElevenLabs API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

## Storage Setup

The function requires the `audio-files` storage bucket to be created in Supabase. This is handled by the migration `20250101000010_create_audio_storage_bucket.sql`.

The bucket includes:
- Public read access for all audio files
- Authenticated user upload permissions
- Service role full access for background jobs
- 10MB file size limit
- Support for audio/mpeg, audio/mp3, audio/wav, audio/ogg formats

## Content Block Status Flow

1. `script_generated` → `audio_generating` (when processing starts)
2. `audio_generating` → `ready` (on successful audio generation)
3. `audio_generating` → `audio_failed` (on failure)

## Audio Storage

Audio files are stored in Supabase Storage using the `audio-files` bucket. Files are organized by content type in folders:

```
audio-files/
├── wake_up/
├── stretch/
├── challenge/
├── weather/
├── encouragement/
├── headlines/
├── sports/
├── markets/
└── user_reminders/
```

Each file follows the naming pattern: `{content_type}/{content_block_id}_{voice}_{timestamp}.mp3`

The `audio_url` field contains the public URL to the stored audio file, which can be directly accessed by the mobile app.

## Error Handling

- Retries failed requests with exponential backoff (max 3 attempts)
- Logs all errors to the `logs` table
- Continues processing other content blocks if one fails
- Returns partial success status (207) if some blocks fail

## Usage

This function is designed to be called manually or via scheduled triggers. It processes content blocks in priority order (by `content_priority` field) and creation date.

## Concurrency Limits

- **ElevenLabs API**: 5 concurrent requests maximum
- **Batch Size**: 5 content blocks per execution
- **Processing**: Sequential processing within each batch to respect API limits
- **Retries**: Exponential backoff with maximum 3 attempts per content block

## Dependencies

- ElevenLabs API for text-to-speech conversion
- Supabase for database operations and logging 