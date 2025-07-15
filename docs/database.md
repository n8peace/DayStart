# DayStart Database Documentation

## 📊 Schema Overview

### **Current Tables (5 total)**
1. `users` - User authentication and basic user data
2. `content_blocks` - Unified content storage for all content types
3. `user_preferences` - Minimal user settings (timezone, location)
4. `user_weather_data` - Weather Kit data cache shared by location
5. `logs` - System-wide logging and monitoring

### **Deployment Status**
- ✅ `users` - Deployed to main branch (production)
- ✅ `content_blocks` - Deployed to main branch (production)
- ✅ `user_preferences` - Deployed to main branch (production)
- ✅ `logs` - Deployed to main branch (production)
- ✅ `user_weather_data` - Deployed to main branch (production)

**Note**: All tables are now deployed to both `develop` and `main` branches. Production environment is live and ready for iOS app development.

## 📋 Table Definitions

### **1. users Table**
**Status**: ✅ Deployed

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `email` | VARCHAR(255) | User's email address |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**Indexes**:
- Primary key on `id`
- Unique index on `email`

**RLS Policies**:
- Users can only access their own data

### **2. content_blocks Table**
**Status**: ✅ Deployed to main branch (production)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `user_id` | UUID | Foreign key to users table (nullable for shared content) |
| `date` | DATE | The date this content is for (morning of...) |
| `content_type` | VARCHAR(50) | Type of content (wake_up, stretch, challenge, etc.) |
| `script` | TEXT | The GPT-4o generated text content |
| `audio_url` | VARCHAR(500) | ElevenLabs generated audio file location |
| `status` | VARCHAR(50) | Current state in the generation pipeline |
| `voice` | VARCHAR(100) | ElevenLabs voice identifier used |
| `duration_seconds` | INTEGER | Duration of the generated audio in seconds |
| `retry_count` | INTEGER | Number of retry attempts for failed operations |
| `content_priority` | INTEGER | Priority for content assembly order (lower = higher priority) |
| `expiration_date` | DATE | When this content expires and should be regenerated |
| `language_code` | VARCHAR(10) | Language code for content (default: 'en-US') |
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

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Primary key, references users table |
| `timezone` | VARCHAR(50) | User's timezone for scheduling and timing |
| `location_zip` | VARCHAR(10) | User's zipcode for location-based content matching |
| `voice` | VARCHAR(100) | ElevenLabs voice identifier for user preference |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**Indexes**:
- Primary key on `user_id`
- Index on `location_zip` for location-based content matching
- Index on `timezone` for timezone-based queries

**Constraints**:
- `user_id` references `users.id`
- `timezone` cannot be null
- `location_zip` cannot be null

**RLS Policies**:
- Users can only read/write their own preferences (user_id = auth.uid())
- Service role can read/write all preferences for background jobs

### **4. logs Table**
**Status**: ✅ Deployed to main branch (production)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `event_type` | VARCHAR(100) | Type of event |
| `user_id` | UUID | User who triggered the event (nullable) |
| `content_block_id` | UUID | Related content block ID (nullable) |
| `status` | VARCHAR(50) | Event status ('success', 'error', 'warning', 'info') |
| `message` | TEXT | Detailed event description |
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
- `status` must be one of: 'success', 'error', 'warning', 'info'
- `created_at` defaults to current timestamp

**RLS Policies**:
- Users can read their own logs (user_id = auth.uid())
- Service role can read/write all logs for system monitoring
- Users cannot write logs (insert/update/delete) - only system can

### **5. user_weather_data Table**
**Status**: ✅ Deployed to main branch (production)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `location_key` | VARCHAR(100) | Location identifier (zipcode for US, lat_lng for international) |
| `date` | DATE | Date this weather data is for |
| `weather_data` | JSONB | Complete Weather Kit response data |
| `last_updated` | TIMESTAMP WITH TIME ZONE | When this data was last fetched or accessed |
| `expires_at` | TIMESTAMP WITH TIME ZONE | When this data expires and should be refreshed |
| `fetch_count` | INTEGER | Number of times this data has been accessed |
| `created_at` | TIMESTAMP WITH TIME ZONE | When the record was first created |
| `updated_at` | TIMESTAMP WITH TIME ZONE | Last modification to the record |

**Location Key Strategy**:
- **US locations**: Uses zipcode (e.g., "10001", "90210")
- **International**: Uses lat_lng format (e.g., "40.7128_-74.0060")

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
- `fetch_count` must be >= 0

**RLS Policies**:
- Users can read weather data (shared resource)
- Service role can manage weather data for background jobs

## 🔐 RLS (Row Level Security) Policies

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
CREATE POLICY "Service role has full access" ON content_blocks
    FOR ALL
    USING (auth.role() = 'service_role');
```

### **user_preferences Table Policies**

#### **1. Enable RLS**
```sql
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
```

#### **2. User Access Policy**
```sql
CREATE POLICY "Users can manage their own preferences" ON user_preferences
    FOR ALL
    USING (user_id = auth.uid());
```

#### **3. Service Role Access Policy**
```sql
CREATE POLICY "Service role has full access" ON user_preferences
    FOR ALL
    USING (auth.role() = 'service_role');
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
CREATE POLICY "Service role has full access" ON logs
    FOR ALL
    USING (auth.role() = 'service_role');
```

## 🚀 Deployment Checklist

### **Pre-Deployment**
- [ ] Review schema design
- [ ] Verify RLS policies
- [ ] Test constraints and indexes
- [ ] Backup existing data (if any)

### **Deployment Steps**
1. Create migration files for each table
2. Deploy to develop branch
3. Verify table creation
4. Apply RLS policies
5. Test basic CRUD operations
6. Verify indexes and constraints

### **Post-Deployment**
- [ ] Verify table structure
- [ ] Test RLS policies
- [ ] Confirm indexes are created
- [ ] Test basic queries
- [ ] Update documentation status

## 📝 Migration History

### **2024-01-01**
- ✅ Created `users` table
- ✅ Applied basic RLS policies

### **2025-01-XX** (Completed)
- ✅ Create `content_blocks` table
- ✅ Create `user_preferences` table  
- ✅ Create `logs` table
- ✅ Create `user_weather_data` table
- ✅ Apply comprehensive RLS policies

## 🔍 Monitoring & Maintenance

### **Regular Checks**
- Monitor table sizes and growth
- Check index usage and performance
- Review RLS policy effectiveness
- Monitor log table growth

### **Cleanup Tasks**
- Archive old content_blocks records
- Clean up expired content
- Rotate old log entries
- Optimize indexes as needed

---

**Document Status**: Active  
**Last Updated**: January 2025  
**Next Update**: After deployment completion 