# Generate Banana Content

A Supabase Edge Function that creates personalized, funny morning wake-up scripts using GPT-4o and user-specific data.

## Purpose

This function generates unique "banana content" - humorous morning wake-up scripts tailored to individual users. It gathers user data, weather information, headlines, and market data, then uses GPT-4o to create a 90-120 second funny script optimized for Eleven Labs voice generation.

## Function Flow

1. **Data Gathering**: Collects user preferences, weather data, and most recent headlines/markets content
2. **Content Extraction**: Extracts structured data from existing content block parameters
3. **Script Generation**: Uses GPT-4o to create a personalized, funny wake-up script
4. **Content Storage**: Creates a content block with `script_generated` status

## API Endpoint

```
POST /functions/v1/generate-banana-content
```

## Request Body

```json
{
  "user_id": "uuid-required"
}
```

## Response

Returns immediately with success status, then processes content asynchronously:

```json
{
  "success": true,
  "message": "Banana content generation started",
  "user_id": "uuid"
}
```

## Data Requirements

The function requires the following data to be available:

- **User Preferences**: `user_preferences` table with user_id, name, city, state, voice
- **Weather Data**: `user_weather_data` table with current weather information (optional - uses user's zipcode as location_key)
- **Headlines**: Most recent `content_blocks` with `content_type: 'headlines'` and status `ready` or `content_ready`
- **Market Data**: Most recent `content_blocks` with `content_type: 'markets'` and status `ready` or `content_ready`

**Note**: The function uses existing content blocks rather than making new API calls, making it more efficient and reliable. Weather data is optional - scripts will be generated without weather references if data is unavailable.

## Voice Support

Supports all three Eleven Labs voices with comprehensive voice-specific instructions:

- **voice_1**: Calm, cosmic, lightly sarcastic - meditative morning guide
- **voice_2**: Commanding, intense, emotionally flat - no-nonsense drill sergeant
- **voice_3**: Warm, dry humor, calm authority - steady, trusted narrator

Each voice includes specific tone metadata, phrase libraries, and break tag guidelines for optimal speech synthesis.

## Content Features

The generated script includes:
- Personalized greeting using user's name and current date
- Weather references in humorous context (when available)
- Current headlines (business, political, pop culture)
- Market summary
- Voice-specific tone and pacing
- Eleven Labs break tags for optimal speech rhythm
- TTS-optimized formatting (expanded numbers, abbreviations)

## Environment Variables

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Error Handling

- Validates UUID format for user_id
- Returns immediate HTTP 200 response
- Processes errors asynchronously and logs them
- Graceful fallbacks for missing data

## Content Block Status

Creates content blocks with:
- `content_type: 'banana'`
- `status: 'script_generated'`
- `script_generated_at` timestamp
- 72-hour expiration
- Priority level 1
- All gathered data stored in both `content` and `parameters` fields
- Weather data stored as `null` when unavailable

## Logging

Logs all events to the `logs` table:
- `banana_content_generated`: Successful generation
- `banana_content_generation_failed`: Failed generation 