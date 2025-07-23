# DayStart Database Schema

## 🎯 Overview

This document describes the complete database schema for DayStart's content generation system. The implementation uses a unified content blocks approach with weather data caching, deployed to main branch (production) and ready for iOS app development.

## 📊 Core Table Structure

### **Purpose**
A unified approach to content management that separates content generation from audio synthesis, with full status tracking and timestamps. This approach simplifies the schema while maintaining all functionality.

## 📋 Table Definitions

### **1. users Table**
**Status**: ✅ Deployed to main branch (production)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `email` | VARCHAR(255er's email address |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**Indexes**:
- Primary key on `id`
- Unique index on `email`

**RLS Policies**:
- Users can only access their own data

### **2. content_blocks Table**
**Status**: ✅ Deployed to main branch (production)

**Purpose**: Stores all content (shared and user-specific) in a unified structure with flexible parameters for different content types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID | Foreign key to users table (nullable for shared content) |
| `date` | DATE | UTC date this content is for (all content uses UTC dates for consistency) |
| `content_type` | VARCHAR(50) | Type of content (wake_up, stretch, challenge, weather, etc.) |
| `content` | TEXT | Raw content text before script generation |
| `script` | TEXT | The GPT-4rated text content |
| `audio_url` | VARCHAR(500) | ElevenLabs generated audio file location |
| `status` | VARCHAR(50| Current state in the generation pipeline |
| `voice` | VARCHAR(100) | ElevenLabs voice identifier used |
| `duration_seconds` | INTEGER | Duration of the generated audio in seconds |
| `retry_count` | INTEGER | Number of retry attempts for failed operations |
| `content_priority` | INTEGER | Priority for content assembly order (lower = higher priority) |
| `expiration_date` | DATE | When this content expires and should be regenerated |
| `language_code` | VARCHAR(10 Language code for content (default: 'en-US) |
| `parameters` | JSONB | Content-specific parameters (zipcode, sport, philosophy, etc.) |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was first created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |
| `script_generated_at` | TIMESTAMP WITH TIME ZONE | When GPT-4o finished generating the script |
| `audio_generated_at` | TIMESTAMP WITH TIME ZONE | When ElevenLabs finished creating the audio |

**Content Types**:

**MVP Content Types:**
- `wake_up` - General wake-up messages and greetings
- `weather` - Weather information and forecasts
- `encouragement` - Motivational and inspirational content
- `headlines` - News headlines and summaries
- `sports` - Sports updates and highlights
- `markets` - Financial market updates and analysis
- `user_intro` - Personalized opening messages
- `user_outro` - Personalized closing messages
- `user_reminders` - Personal reminders and tasks

**Future Content Types (Not in MVP):**
- `stretch` - Morning stretch routines and instructions
- `challenge` - Brain teasers, puzzles, and mental challenges

**Status Values**:
- `pending` - Record created, waiting to start generation
- `script_generating` - GPT-4o is working on script
- `script_generated` - Script ready, waiting for audio generation
- `audio_generating` - ElevenLabs is working on audio
- `ready` - Complete and available for use
- `content_ready` - Content generation completed successfully
- `content_failed` - Content generation failed
- `script_failed` - GPT-4o generation failed
- `audio_failed` - ElevenLabs generation failed
- `failed` - General failure state
- `expired` - Content is too old to use
- `retry_pending` - Scheduled for retry

**Indexes**:
- Primary key on `id`
- Index on `(content_type, date)` for shared content lookups
- Index on `(user_id, content_type, date)` for user-specific content
- Index on `status` for background job queries
- Index on `created_at` for cleanup operations
- Index on `expiration_date` for content expiration checks
- Index on `content_priority` for assembly ordering
- Index on `language_code` for language-specific queries
- GIN index on `parameters` for JSONB queries

**Constraints**:
- `user_id` references `users.id` (when present)
- `content_type` must be one of the defined content types
- `status` must be one of the defined status values
- `date` cannot be in the past (for new records)
- `expiration_date` must be >= date
- `script_generated_at` must be after `created_at`
- `audio_generated_at` must be after `script_generated_at`
- `retry_count` must be >= 0
- `duration_seconds` must be >= 0
- `content_priority` must be >= 0
- `language_code` defaults to 'en-US'

**RLS Policies**:
- Users can read shared content (user_id IS NULL)
- Users can read/write their own user-specific content (user_id = auth.uid())
- Service role can read/write all content for background jobs

### **3. user_preferences Table**
**Status**: ✅ Deployed to main branch (production)

**Purpose**: Stores minimal user settings that are critical for backend operations. Content type preferences and specific interests are managed by the app and passed as parameters during content requests.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Primary key, references users table |
| `timezone` | VARCHAR(50) | User's timezone for scheduling and timing |
| `location_zip` | VARCHAR(10) | User's zipcode for location-based content matching |
| `name` | VARCHAR(100) | User's display name for personalization |
| `city` | VARCHAR(100) | User's city for location-based content matching |
| `state` | VARCHAR(2) | User's state (2-letter code) for location-based content matching |
| `voice` | VARCHAR(100) | ElevenLabs voice identifier for user preference |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**App-Managed Preferences**:
The following preferences are managed by the app and passed as parameters during content requests:
- **Content type toggles** - Which content types to include in morning message
- **Sports teams** - Favorite teams and leagues
- **News categories** - Preferred news topics
- **Philosophical approach** - Stoic, Buddhist, Christian, etc.
- **Challenge preferences** - Math, logic, trivia, etc.

**Indexes**:
- Primary key on `user_id`
- Index on `location_zip` for location-based content matching
- Index on `timezone` for timezone-based queries
- Index on `name` for name-based queries
- Index on `city` for city-based content matching
- Index on `state` for state-based content matching

**Constraints**:
- `user_id` references `users.id`
- `timezone` cannot be null
- `location_zip` cannot be null
- `name` cannot be empty if provided
- `city` cannot be empty if provided
- `state` must be exactly 2 characters if provided

**RLS Policies**:
- Users can only read/write their own preferences (user_id = auth.uid())
- Service role can read/write all preferences for background jobs

### **4. user_weather_data Table**
**Status**: ✅ Deployed to main branch (production)

**Purpose**: Stores Weather Kit data as a shared resource, allowing multiple users in the same location to benefit from cached weather data without redundant API calls.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `location_key` | VARCHAR(100) | Unique location identifier (zipcode or lat/lng) |
| `date` | DATE | Date this weather data is for |
| `weather_data` | JSONB | Complete Weather Kit response data |
| `last_updated` | TIMESTAMP WITH TIME ZONE | When this data was last fetched |
| `expires_at` | TIMESTAMP WITH TIME ZONE | When this data expires and should be refreshed |
| `fetch_count` | INTEGER | Number of times this data has been accessed |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was first created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**Location Key Strategy**:
The `location_key` field uses a standardized format to identify unique locations:

**For US locations:**
- Format: `zipcode` (e.g., "101, *For international locations:**
- Format: `lat_lng` (e.g., 40.7128_-7460 for NYC)

**Indexes**:
- Primary key on `id`
- Index on `(location_key, date)` for location lookups
- Index on `expires_at` for cleanup operations
- Index on `last_updated` for refresh operations
- GIN index on `weather_data` for JSONB queries

**Constraints**:
- `location_key` cannot be null
- `date` cannot be null
- `expires_at` must be after `created_at`
- Unique constraint on `(location_key, date)`
- `fetch_count` must be >=0

**RLS Policies**:
- Users can read weather data (shared resource)
- Service role can manage weather data for background jobs

### **5s Table**
**Status**: ✅ Deployed to main branch (production)

**Purpose**: System-wide logging for debugging, monitoring, analytics, and audit trails.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `event_type` | VARCHAR(100| Type of event |
| `user_id` | UUID | User who triggered the event (nullable) |
| `content_block_id` | UUID | Related content block ID (nullable) |
| `status` | VARCHAR(50 | Event status ('success',error', warning', 'info) || `message` | TEXT | Detailed event description |
| `metadata` | JSONB | Additional event data |
| `ip_address` | INET | IP address of the request (nullable) |
| `user_agent` | VARCHAR(500) | User agent string (nullable) |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the event occurred |

**Event Types**:
- `content_generated` - Content generation events
- `alarm_triggered` - Alarm activation events
- `user_login` - User authentication events
- `api_call` - External API calls
- `error_occurred` - System errors and exceptions
- `background_job` - Background job execution
- `content_assembly` - Content combination events
- `cache_hit` - Cache usage events
- `storage_operation` - File storage operations

**Indexes**:
- Primary key on `id`
- Index on `event_type` for filtering
- Index on `created_at` for time-based queries
- Index on `user_id` for user-specific logs
- Index on `status` for error monitoring
- Index on `content_block_id` for content-specific logs
- Composite index on `(user_id, created_at)` for user timeline queries
- Composite index on `(event_type, status)` for event monitoring

**Constraints**:
- `event_type` cannot be null
- `user_id` references `users.id` (when present)
- `content_block_id` references `content_blocks.id` (when present)
- `status` must be one of:success',error', warning',info'
- `created_at` defaults to current timestamp

**RLS Policies**:
- Users can read their own logs (user_id = auth.uid())
- Service role can read/write all logs for system monitoring
- Users cannot write logs (insert/update/delete) - only system can

### **6. audio-files Storage Bucket**
**Status**: ✅ Ready for deployment to develop branch

**Purpose**: Stores all generated audio files organized by content type

**Structure**:
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

**File Naming**: `{content_type}/{content_block_id}_{voice}_{timestamp}.aac`

**Configuration**:
- Public read access for all audio files
- Authenticated user upload permissions
- Service role full access for background jobs
- 10MB file size limit
- Supported formats: audio/mpeg, audio/mp3, audio/wav, audio/ogg, audio/aac

**RLS Policies**:
- Public read access to all audio files
- Authenticated users can upload audio files
- Service role has full access for background jobs
- Users can update/delete their own audio files

## 🔄 Content Generation Pipeline

### **Phase 1: Content Creation (Cron Job)**
- Runs daily at 2AM (configurable)
- Creates `pending` records for each content type
- Sets appropriate `expiration_date` based on content type
- Handles both shared and user-specific content

### **Phase 2: Content-Specific Data Fetching**
Each content function:
- Queries `content_blocks` where `status = 'pending'` AND `content_type = specific_type'`
- Fetches relevant external data via APIs
- Updates record with text summary in `content` field and API data in `parameters` JSONB
- Sets status to `content_ready` (partial failures OK) or `content_failed` (complete failure)
- Logs all API calls and failures to `logs` table

### **Phase 3: Script Generation**
- Queries `content_blocks` where `status = content_ready'`
- Processes each content type with appropriate GPT-4o prompts
- Updates record with generated `script`
- Sets `script_generated_at` timestamp
- Sets status to `script_generated`

### **Phase 4: Audio Generation**
- Queries `content_blocks` where `status = script_generated'`
- Uses optimistic locking to prevent race conditions and duplicate processing
- Sends script to ElevenLabs with appropriate voice
- Stores generated audio URL in `audio_url`
- Updates `duration_seconds` and `audio_generated_at`
- Sets status to `ready`

## 📊 Content Type Processing

### **Shared Content (user_id = NULL)**
| Content Type | Data Source | Generation Frequency | Expiration | Content Priority |
|--------------|-------------|---------------------|------------|------------------|
| `wake_up` | Abstracts API (holidays) | Daily | 72s |1weather` | Weather Kit API (via user_weather_data) | Hourly | 72ours |2 |
| `headlines` | News API + GNews API (general category) | 4hours | 72rs | 3 |
| `sports` | SportsDB API (eventsday.php) + ESPN API | 4hours | 72s |4 `markets` | Yahoo Finance API (market/v2/get-quotes) + News API (business) | Hourly | 72hours | 5 |
| `encouragement` | Template-based (5 types) | Daily | 72ours |6## **User-Specific Content (user_id = specific)**
| Content Type | Data Source | Generation Frequency | Expiration |
|--------------|-------------|---------------------|------------|
| `user_intro` | User preferences | When saved | null |
| `user_outro` | User preferences | When saved | null |
| `user_reminders` | User data | When saved | When deleted by user |

## 🎤 Voice Configuration

### **ElevenLabs Voices**
- **`voice_1Female, meditative wake-up voice
- **`voice_2le, drill sergeant voice
- **`voice_3`** - Male, narrative voice

### **Voice Assignment Strategy**
- **Content Generation**: Creates single rows without voice assignment
- **Script Generation**: Adds voice variants (voice_1, voice_2e_3) during script creation phase
- **Future**: Each content type will have 3 voice variants for user variety

## 🔐 RLS Policies

### **content_blocks Table Policies**

#### **1. Enable RLS**
```sql
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
```

#### **2. Read Shared Content Policy**
```sql
CREATE POLICY "Users can read shared content" ON content_blocks
    FOR SELECT
    USING (user_id IS NULL);
```

#### **3. Read User-Specific Content Policy**
```sql
CREATE POLICY "Users can read their own content" ON content_blocks
    FOR SELECT
    USING (user_id = auth.uid());
```

#### **4. Write User-Specific Content Policy**
```sql
CREATE POLICY "Users can write their own content" ON content_blocks
    FOR ALL
    USING (user_id = auth.uid());
```

#### **5. Service Role Full Access Policy**
```sql
CREATE POLICYService role has full access" ON content_blocks
    FOR ALL
    USING (auth.role() =service_role');
```

### **user_preferences Table Policies**

#### **1. Enable RLS**
```sql
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
```

#### **2. User Access Policy**
```sql
CREATE POLICYUsers can manage their own preferences" ON user_preferences
    FOR ALL
    USING (user_id = auth.uid());
```

#### **3. Service Role Access Policy**
```sql
CREATE POLICYService role has full access" ON user_preferences
    FOR ALL
    USING (auth.role() =service_role');
```

### **logs Table Policies**

#### **1. Enable RLS**
```sql
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
```

#### **2. User Read Policy**
```sql
CREATE POLICY "Users can read their own logs" ON logs
    FOR SELECT
    USING (user_id = auth.uid());
```

#### **3. Service Role Full Access Policy**
```sql
CREATE POLICYService role has full access" ON logs
    FOR ALL
    USING (auth.role() =service_role');
```

## 📈 Performance Considerations

### **Query Optimization**
```sql
-- Find weather data for location and date
SELECT weather_data FROM user_weather_data 
WHERE location_key = 101 AND date =20255Find ready content for user and date
SELECT * FROM content_blocks 
WHERE user_id =abc123 AND date = '20250115ND status =ready;

-- Find shared content for date
SELECT * FROM content_blocks 
WHERE user_id IS NULL AND date = '20250115ND status =ready';
```

### **Content Date Strategy**
All content generation functions use **UTC dates** for consistency and to avoid timezone confusion. The app retrieves the most recent content by querying for the latest `created_at` timestamp within each content type.

**Date Generation Logic**:
```javascript
// All functions use this UTC date generation
const utcDate = new Date().toISOString().split(T
```

**App Retrieval Strategy**:
The iOS app queries for the most recent content using:
```sql
SELECT * FROM content_blocks 
WHERE content_type = 'headlines' 
AND status =content_ready' 
ORDER BY created_at DESC 
LIMIT 1
```

## ✅ Current Status

All tables are **live in production** and ready for iOS app development:

- ✅ **users** - User authentication deployed
- ✅ **content_blocks** - Unified content storage deployed
- ✅ **user_preferences** - User settings deployed
- ✅ **logs** - System logging deployed
- ✅ **user_weather_data** - Weather caching system deployed
- ✅ **audio-files** storage bucket - Ready for deployment

---

**Document Status**: Active  
**Last Updated**: January 2025 
**Next Update**: After deployment completion 