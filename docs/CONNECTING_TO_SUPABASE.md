# Connecting to DayStart Supabase

This guide provides a streamlined process to connect your local development environment to the DayStart Supabase project.

## 🚀 Quick Start (2-Minute Setup)

**If you're setting up for the first time or reconnecting:**

```bash
# 1. Check if Supabase CLI is installed
which supabase

# 2. Link to the project (do this ONCE in your project root)
# For develop environment:
supabase link --project-ref your_supabase_develop_project

# For production environment:
supabase link --project-ref your_supabase_main_project

# 3. Set up environment variables (if .env doesn't exist)
cp .env.example .env  # or create manually

# 4. Verify connection
supabase functions list
supabase migration list

# 5. Test system status
supabase status
```

**Expected Results:**
- ✅ Functions show as ACTIVE (when deployed)
- ✅ Migrations show as synced (Local | Remote)
- ✅ System status check passes

## 📋 Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Access to the DayStart project dashboard
- Environment variables configured (see below)

## 🔧 Environment Variables Setup

### Option 1: Use Existing .env File (Recommended)
The project includes a `.env.example` file with the correct structure:

```bash
# Copy and edit the example file
cp .env.example .env

# Edit .env with your actual keys
```

### Option 2: Create New .env File
Create `.env` with your project details:

```bash
# Supabase Configuration (Develop Environment)
SUPABASE_URL=https://your_supabase_develop_project.supabase.co
SUPABASE_ANON_KEY=your_develop_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_develop_service_role_key
SUPABASE_DEVELOP_PROJECT=your_supabase_develop_project

# Supabase Configuration (Production Environment)
# SUPABASE_URL=https://your_supabase_main_project.supabase.co
# SUPABASE_ANON_KEY=your_production_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
# SUPABASE_MAIN_PROJECT=your_supabase_main_project

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o

# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_default_voice_id

# App Configuration
APP_ENV=development
APP_VERSION=1.0.0
```

## 🔗 Project Linking

### Step 1: Link to Project
```bash
# For develop environment
supabase link --project-ref your_supabase_develop_project

# For production environment
supabase link --project-ref your_supabase_main_project
```

**What happens:**
- Connects to remote database
- Sets up migration tracking
- May show Docker warnings (ignore for remote-only development)

### Step 2: Verify Connection
```bash
# Check functions status
supabase functions list

# Check migration sync
supabase migration list

# Test database access (replace with your actual keys)
curl -s "https://your_supabase_develop_project.supabase.co/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## ✅ Connection Verification

### Quick Health Check
```bash
# Test function health (when functions are deployed)
curl -s "https://your_supabase_develop_project.supabase.co/functions/v1/generate-message" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Expected response (when function exists):
# {"status":"healthy","timestamp":"2025-07-14T...","function":"generate-message"}
```

### System Status Check
```bash
# Check Supabase status
supabase status

# Check migration status
supabase migration list
```

**Expected Results:**
- ✅ Functions ACTIVE (when deployed)
- ✅ Database tables accessible
- ✅ Environment variables set
- ✅ Migration tracking active

## 🗄️ Database Status

### Current System State (July 2025)
- **Users**: 0+ users (new project)
- **Alarms**: 0+ configured alarms (new project)
- **Functions**: 2 functions ready for deployment
- **Migrations**: 1 migration (users table)

### Key Tables
```bash
# Check table counts (after users table is deployed)
curl -s "https://your_supabase_develop_project.supabase.co/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 🚀 Development Commands

### Function Management
```bash
# Deploy specific function
supabase functions deploy generate-message
supabase functions deploy test-voice

# Deploy all functions
supabase functions deploy

# View function logs
supabase functions logs generate-message
supabase functions logs test-voice
```

### Database Operations
```bash
# Apply migrations
supabase db push

# Check migration status
supabase migration list

# Reset database (CAUTION: destroys all data)
supabase db reset
```

### Testing
```bash
# Test database connection
curl -s "https://your_supabase_develop_project.supabase.co/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# Test function endpoints (when deployed)
curl -s "https://your_supabase_develop_project.supabase.co/functions/v1/generate-message" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 🔍 Troubleshooting

### Common Issues & Quick Fixes

**1. "Invalid API key" errors**
```bash
# Ensure both headers are set
curl -s "https://your_supabase_develop_project.supabase.co/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**2. Migration sync issues**
```bash
# Check migration status
supabase migration list

# If migrations are out of sync, repair tracking:
supabase migration repair --status applied <migration_id>
```

**3. Function deployment fails**
```bash
# Check function status
supabase functions list

# Redeploy specific function
supabase functions deploy <function_name>
```

**4. Connection refused errors**
```bash
# Verify project reference
supabase status

# Re-link to project
supabase link --project-ref your_supabase_develop_project
```

## 🔐 Security Notes

- **Never commit API keys** to version control
- **Use environment variables** for all sensitive data
- **Project references are documented** but not exposed in public repositories
- **Service role keys** should only be used in secure environments

## 📚 Next Steps

1. **Deploy the users table** using CI/CD pipeline
2. **Test Edge Functions** for AI message generation
3. **Set up iOS app** to connect to Supabase
4. **Configure authentication** flow
5. **Deploy to production** when ready

## 🆘 Getting Help

- Check [Supabase Documentation](https://supabase.com/docs)
- Review project logs in Supabase Dashboard
- Check local logs with `supabase logs`
- Create an issue in this repository for project-specific problems 