# Generate Script Function

This function generates scripts for all content types in the DayStart app using GPT-4o.

## Overview

The `generate-script` function is responsible for:
1. Processing content_ready rows in batches (up to 100 rows per run)
2. Generating scripts for all content types using GPT-4o
3. Creating voice-specific content blocks for shared content
4. Updating user-specific content with single voice scripts
5. Managing the script generation workflow with comprehensive logging

## Files

- `index.ts` - Main function implementation
- `prompts.ts` - Reference file containing all GPT-4o prompts for each content type
- `README.md` - This documentation

## Content Types Supported

The function supports all content types defined in the database schema:

- `wake_up` - Motivational morning wake-up messages
- `stretch` - Morning stretch and mobility routines
- `challenge` - Daily personal development challenges
- `weather` - Weather reports and forecasts
- `encouragement` - Supportive and encouraging messages
- `headlines` - News headlines summaries
- `sports` - Sports updates and highlights
- `markets` - Financial market updates
- `user_intro` - Personalized morning introductions
- `user_outro` - Personalized closing messages
- `user_reminders` - Supportive reminder messages

## Voice System

The app supports three distinct ElevenLabs voices, each requiring unique script adaptations:

### Voice 1 - Female Meditative Voice
- **Character**: Gentle, meditative, and coaxing
- **Purpose**: Coaxes the user out of bed with a calm, nurturing approach
- **Tone**: Soft, encouraging, patient
- **Script Style**: Uses gentle language, breathing cues, and gradual awakening techniques

### Voice 2 - Male Drill Sergeant Voice
- **Character**: Fast, intense, and commanding
- **Purpose**: Orders the user to get out of bed with authority and urgency
- **Tone**: Direct, energetic, motivating (no curse words)
- **Script Style**: Uses commanding language, short sentences, and urgent calls to action

### Voice 3 - Male Narrator Voice
- **Character**: Calm, steady, and reliable
- **Purpose**: Provides information and guidance with a balanced approach
- **Tone**: Professional, measured, trustworthy
- **Script Style**: Uses clear, informative language with medium cadence and structured delivery

## Content Generation Workflow

### Shared Content (user_id IS NULL)
For each content type and date, the system generates:

1. **Three Scripts** - One optimized for each voice character
2. **Three Content Blocks** - Separate database rows for each voice
3. **Three Audio Files** - ElevenLabs-generated audio for each script

This ensures users can choose their preferred voice style while maintaining content consistency across all three versions.

### User-Specific Content (user_id IS NOT NULL)
For user-specific content, the system generates:

1. **One Script** - Optimized for the user's preferred voice (defaults to voice_1)
2. **One Content Block** - Updated with the generated script
3. **One Audio File** - ElevenLabs-generated audio for the script

## Function Behavior

### Manual Trigger
The function runs when manually pinged with no request body required.

### Batch Processing
- Processes up to 100 content_ready rows per run
- Processes oldest to newest based on created_at timestamp
- Continues processing even if individual voices fail
- Retries failed voices up to 3 times with exponential backoff

### Processing Logic
1. **Query**: Find all rows with `status = 'content_ready'` ORDER BY created_at ASC LIMIT 100
2. **Update**: Set status to `script_generating` for each row being processed
3. **Generate**: Create scripts using GPT-4o with voice-specific prompts
4. **Store**: Update/create content blocks with generated scripts
5. **Log**: Comprehensive logging for all operations

### Status Flow
- `content_ready` → `script_generating` → `script_generated`/`script_failed`

## API Usage

### Request
```json
{}
```
No request body required - function processes all available content_ready rows.

### Response
```json
{
  "success": true,
  "message": "Script generation batch completed",
  "total_content_blocks": 5,
  "total_processed": 12,
  "total_errors": 2,
  "results": [
    {
      "content_block_id": "uuid",
      "content_type": "wake_up",
      "user_id": null,
      "success": true,
      "processed_count": 3,
      "errors": []
    }
  ]
}
```

## Prompt Structure

Each content type has a defined prompt structure in `prompts.ts`:

```typescript
{
  systemPrompt: "Role and context for GPT-4o with voice-specific instructions",
  userPrompt: (params) => "Dynamic prompt with parameters",
  maxTokens: 200,
  temperature: 0.8
}
```

## Parameters

Common parameters that can be passed to customize content generation:

- `date` - Target date for content
- `dayOfWeek` - Day of the week
- `previousMessage` - Previous content to avoid repetition
- `userPreferences` - User-specific preferences
- `weatherData` - Weather information
- `holidayData` - Holiday information

## Error Handling

### Retry Logic
- Failed GPT-4o calls retry up to 3 times with exponential backoff
- Individual voice failures don't prevent other voices from being generated
- Database operation failures are logged but don't stop batch processing

### Status Tracking
- Each content block gets its own status (script_generated or script_failed)
- Failed rows maintain their error information for debugging
- Comprehensive logging tracks all operations and failures

## Logging

The function logs all operations to the `logs` table:

### Event Types
- `script_generation_started` - When processing begins for a content block
- `script_generated` - When a script is successfully generated
- `script_generation_failed` - When script generation fails
- `script_generation_batch_completed` - When the entire batch completes
- `script_generation_batch_failed` - When the entire batch fails

### Metadata
Each log entry includes relevant metadata:
- content_type, date, user_id
- voice, script_length, retry_count
- error details for failures
- batch statistics for completion events

## Configuration

### Hardcoded Values
- **Batch Size**: 100 rows per run
- **Max Retries**: 3 attempts per voice
- **Retry Delay**: Exponential backoff (1s, 2s, 3s)
- **Default Voice**: voice_1 for user content without specified voice

### Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o access 