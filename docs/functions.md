# DayStart Edge Functions Documentation

## Overview

DayStart uses 11 Supabase Edge Functions to power its AI-driven content generation system. These functions work together to create personalized morning messages with high-quality voice synthesis.

**Deployment Strategy**: Functions are deployed using an update-only approach that ensures reliable deployments without authentication or project-specific issues.

## Function Architecture

### Content Generation Functions (6se functions fetch external data and create content blocks for different content types:1. **`generate-wake-up-content`** - Daily wake-up messages and holiday information
2. **`generate-weather-content`** - Weather reports and forecasts  
3. **`generate-headlines-content`** - News headlines and summaries
4. **`generate-sports-content`** - Sports updates and highlights
5. **`generate-markets-content`** - Financial market updates
6`generate-encouragement-content`** - Motivational content (5 types)

### Processing Functions (2e functions handle the content generation pipeline:7**`generate-script`** - GPT-4o script generation for all content types
8. **`generate-audio`** - ElevenLabs audio synthesis from scripts

### Maintenance Functions (3e functions handle system maintenance and monitoring:9. **`cleanup-stuck-content`** - Cleans up stuck content generation10*`expiration-clean-up`** - Removes expired content and audio files
11. **`health-check`** - Comprehensive system monitoring and reporting

## Content Generation Functions

### generate-wake-up-content
**Purpose**: Creates daily wake-up messages with holiday information  
**Priority**: 1 (Highest)  
**Frequency**: Daily  
**Data Source**: Calendarific API (holidays)  
**Status**: `content_ready` on success

**Features**:
- Fetches holiday data from Calendarific API
- Avoids repetition by checking previous messages
- Includes day of week and date information
- Handles API failures gracefully

### generate-weather-content
**Purpose**: Creates weather reports for user locations  
**Priority**: 2*Frequency**: Hourly  
**Data Source**: Weather Kit API (via user_weather_data cache)  
**Status**: `content_ready` on success

**Features**:
- Uses cached weather data from `user_weather_data` table
- Supports multiple locations per execution
- Includes temperature, conditions, sunrise/sunset
- Handles missing weather data gracefully

### generate-headlines-content
**Purpose**: Creates news headlines summaries  
**Priority**: 3  
**Frequency**: 4 hours  
**Data Sources**: News API + GNews API  
**Status**: `content_ready` (partial failures OK) or `content_failed` (complete failure)

**Features**:
- Fetches from multiple news sources for redundancy
- Combines headlines from both APIs
- Handles API failures with fallback content
- Includes error information in parameters

### generate-sports-content
**Purpose**: Creates enhanced sports updates with dates, locations, and sports news  
**Priority**: 4  
**Frequency**: 4 hours  
**Data Sources**: ESPN API (multiple sports) + News API (sports)  
**Status**: `content_ready` (partial failures OK) or `content_failed` (complete failure)  
**Version**: 2.0-enhanced

**Features**:
- **Enhanced Sports Data Processing**: Importance scoring based on sport, status, and game closeness
- **Date and Location Integration**: Includes game dates, times, and venue locations
- **Sports News Integration**: News API sports headlines with relevance scoring
- **Sports Trend Analysis**: Activity levels, key events, and live game tracking
- **Fetches data from ESPN APIs** for major US sports (NFL, NBA, MLB, NHL, NCAA Football, NCAA Basketball)
- **Handles API failures gracefully** with fallback content
- **Provides comprehensive sports summaries** with scores, schedules, and news

### generate-markets-content
**Purpose**: Creates enhanced financial market updates with trend analysis  
**Priority**: 5  
**Frequency**: Hourly  
**Data Sources**: Yahoo Finance API + News API (business)  
**Status**: `content_ready` (partial failures OK) or `content_failed` (complete failure)  
**Version**: 2.0-enhanced

**Features**:
- **Enhanced Market Data Processing**: Importance scoring based on volume, market cap, and change magnitude
- **Market Trend Analysis**: Bullish/bearish sentiment, volatility assessment, key movers identification
- **Business News Scoring**: Source reliability, market relevance, recency, and content quality scoring
- **Explicit Data Availability**: Clear messaging when APIs are unavailable or misconfigured
- **Rich Content Generation**: Prioritized market data with trend summaries and top-scored business news
- **Enhanced Logging**: Processing version tracking, detailed analysis metrics, API key status logging
- **Fallback Handling**: Graceful degradation with explicit fallback content messaging

### generate-encouragement-content
**Purpose**: Creates motivational content in5ories  
**Priority**: 6 (Lowest)  
**Frequency**: Daily  
**Data Source**: Template-based  
**Status**: `content_ready` on success

**Features**:
- Generates 5 types: Christian, Stoic, Muslim, Jewish, General
- Uses template-based content generation
- Avoids repetition by tracking previous content
- Each type gets its own content block

## Processing Functions

### generate-script
**Purpose**: Generates GPT-4ts for all content types  
**Input**: Content blocks with `status = 'content_ready'`  
**Output**: Content blocks with `status = script_generated'`  
**Batch Size**: 100content blocks per execution

**Voice System**:
- **voice_1**: Female meditative voice - gentle, coaxing
- **voice_2**: Male drill sergeant voice - commanding, energetic  
- **voice_3ale narrator voice - calm, professional

**Processing Logic**:
1. For shared content: Creates 3ce variants (voice_1, voice_2ice_3)
2. For user content: Creates 1script with users preferred voice
3. Uses voice-specific prompts for each content type4failed generations up to3mes

**Status Flow**: `content_ready` → `script_generating` → `script_generated`/`script_failed`

### generate-audio
**Purpose**: Converts scripts to audio using ElevenLabs  
**Input**: Content blocks with `status = script_generated'`  
**Output**: Content blocks with `status = ready'`  
**Batch Size**: 5 content blocks per execution (matches ElevenLabs concurrency limit)

**Features**:
- Uses ElevenLabs Multilingual v2 model
- Supports 29+ languages
- Stores audio files in Supabase Storage
- Organizes files by content type
- Updates content blocks with audio URLs and duration

**Status Flow**: `script_generated` → `audio_generating` → `ready`/`audio_failed`

**Storage Structure**:
```
audio-files/
├── wake_up/
├── weather/
├── headlines/
├── sports/
├── markets/
└── encouragement/
```

## Maintenance Functions

### cleanup-stuck-content
**Purpose**: Cleans up content blocks stuck in processing states  
**Trigger**: Manual or scheduled  
**Timeout**: 1 hour for stuck content

**Process**:
1. Finds content blocks stuck in `script_generating`, `audio_generating`, `content_generating`, or `retry_pending` for >1 hour2 Updates status to appropriate failure state
3. Resets retry count
4. Logs cleanup actions

**Status Mapping**:
- `script_generating` → `script_failed`
- `audio_generating` → `audio_failed`
- `content_generating` → `content_failed`
- `retry_pending` → `failed`

### expiration-clean-up
**Purpose**: Removes expired content and audio files  
**Trigger**: Manual or scheduled  
**Process**: Finds content blocks past expiration date and removes associated audio files

**Features**:
- Deletes audio files from Supabase Storage
- Updates content block status to `expired`
- Handles storage deletion failures gracefully
- Logs all cleanup actions

### health-check
**Purpose**: Comprehensive system monitoring and reporting  
**Trigger**: Manual or scheduled (recommended: daily)  
**Output**: Email reports with system health status

**Health Checks**:
1. **Database Connectivity** - Tests Supabase connection and table access
2. **Content Pipeline Health** - Monitors content_blocks status distribution3ent Error Analysis** - Analyzes errors from last24hours
4. **Expired Content Monitoring** - Detects content requiring cleanup5xternal API Health** - Tests OpenAI, ElevenLabs, News, Weather APIs
6 Activity Tracking** - Monitors user registrations and engagement

**Email Features**:
- Beautiful HTML reports with status indicators
- Color-coded alerts (green/yellow/red)
- Detailed metrics and recommendations
- Mobile-friendly design

## Shared Infrastructure

### Shared Modules
All functions use shared modules for consistency:

- **`shared/types.ts`** - Common interfaces (ContentBlock, LogEntry)
- **`shared/config.ts`** - CORS headers and environment validation
- **`shared/utils.ts`** - Error handling, logging, and date utilities

### Environment Variables
**Required for all functions**:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

**Content generation functions**:
- `OPENAI_API_KEY` - For GPT-4o script generation
- `ELEVEN_LABS_API_KEY` - For audio synthesis
- `NEWS_API_KEY` - For news content
- `RAPID_API_KEY` - For market data
- `CALENDARIFIC_API_KEY` - For holiday data

**Health check function**:
- `RESEND_API_KEY` - For email notifications (optional)

### Database Tables
Functions interact with these tables:
- `content_blocks` - Main content storage
- `user_weather_data` - Weather data cache
- `logs` - System logging
- `users` - User authentication
- `user_preferences` - User settings

## Deployment

### Deploy All Functions
```bash
npm run functions:deploy:all
```

### Deploy Individual Function
```bash
npm run functions:deploy
# Then select specific function
```

### Local Development
```bash
npm run dev:supabase  # Start local Supabase
npm run db:reset      # Reset database
```

## Monitoring

### Logs
All functions log to the `logs` table with:
- Event type and status
- Detailed metadata
- Error information
- Performance metrics

### Health Monitoring
Use the `health-check` function for:
- Daily system status reports
- Error trend analysis
- Performance monitoring
- External API status

### Common Issues
1**Stuck Content**: Use `cleanup-stuck-content` function
2. **Expired Content**: Use `expiration-clean-up` function3 **API Failures**: Check external API keys and rate limits
4. **Storage Issues**: Verify audio-files bucket exists and has proper permissions

## Performance Considerations

### Batch Processing
- Content generation: Processes all available content per type
- Script generation: 100content blocks per batch
- Audio generation: 5 content blocks per batch (ElevenLabs limit)

### Concurrency Limits
- ElevenLabs API: 5 concurrent requests maximum
- OpenAI API: No strict limit, but respect rate limits
- Database: Optimized queries with proper indexing

### Timeouts
- Function timeout: 30onds (configurable)
- External API timeouts: 5-30 seconds depending on API
- Database operations: Optimized for performance

## Security

### Authentication
- All functions use service role for database access
- Environment variables for API keys
- No user authentication required (background processing)

### Data Protection
- RLS policies protect user data
- Service role has minimal required permissions
- All operations logged for audit purposes

### API Security
- API keys stored as environment variables
- No hardcoded credentials
- Proper error handling prevents information leakage

## Development Practices

### Code Standards
- Use TypeScript for all functions
- Include comprehensive error handling
- Add input validation for all parameters
- Document function purpose and behavior
- Follow consistent naming conventions

### Last Updated Date Convention
Every function file must include a "Last Updated" comment at the top of the file:

```typescript
// Last Updated: 2024-07-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// ... rest of function code
```

**When to Update:**
- Any code changes to the function
- Bug fixes or improvements
- New features or functionality
- Documentation updates within the function
- Configuration changes

**Format:**
- Use YYYY-MM-DD format (e.g., "2024-07-20")
- Update to the current date when making changes
- Place at the very top of the file, before imports

### Function Testing
- Test locally using `supabase functions serve`
- Verify error handling with invalid inputs
- Test API integrations and fallback scenarios
- Validate database operations and logging

---

**Last Updated**: July 2024 