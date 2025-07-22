# Generate Banana Content

A Supabase Edge Function that creates personalized, funny morning wake-up scripts using GPT-4o and user-specific data.

## Purpose

This function generates unique "banana content" - humorous morning wake-up scripts tailored to individual users. It gathers user data, weather information, headlines, and market data, then uses GPT-4o to create a 90-120 second funny script optimized for Eleven Labs voice generation.

## Function Flow

1. **Data Gathering**: Collects user preferences, weather data, headlines, and market information
2. **Script Generation**: Uses GPT-4o to create a personalized, funny wake-up script
3. **Content Storage**: Creates a content block with `script_generated` status

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
- **Weather Data**: `user_weather_data` table with current weather information
- **Headlines**: `content_blocks` table with `content_type: 'headlines'` and status `ready` or `content_ready`
- **Market Data**: `content_blocks` table with `content_type: 'markets'` and status `ready` or `content_ready`

## Voice Support

Supports all three Eleven Labs voices with voice-specific prompts:

- **voice_1**: Female, meditative, calm, and soothing
- **voice_2**: Male, drill sergeant, energetic, and commanding  
- **voice_3**: Male, narrative, warm, and conversational

## Content Features

The generated script includes:
- Personalized greeting using user's name
- Weather references in humorous context
- Current headlines (business, political, pop culture)
- Market summary
- Natural speech patterns optimized for voice generation

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
- 72-hour expiration
- Priority level 1
- All gathered data stored in `parameters` field

## Logging

Logs all events to the `logs` table:
- `banana_content_generated`: Successful generation
- `banana_content_generation_failed`: Failed generation 