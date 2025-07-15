# DayStart Supabase Setup Guide

## 🎯 Project Overview

DayStart uses Supabase as the backend service for:
- **Authentication**: User signup/login
- **Database**: PostgreSQL for user data, preferences, and alarm settings
- **Storage**: Audio files and user assets
- **Real-time**: Live updates for alarm status

> **Note:** As of now, there are no deployed functions or application code. The setup and integration instructions are for future use.

## 🚀 Quick Start (2-Minute Setup)

**If you're setting up for the first time or reconnecting:**

```bash
# 1. Check if Supabase CLI is installed
which supabase

# 2. Link to the project (do this ONCE in your project root)
# For develop environment:
supabase link --project-ref project_ref

# For production environment:
supabase link --project-ref project_ref

# 3. Set up environment variables (if .env doesn't exist)
cp .env.example .env  # or create manually

# 4. Verify connection
supabase migration list

# 5. Test system status
supabase status
```

**Expected Results:**
- ✅ Migrations show as synced (Local | Remote)
- ✅ System status check passes

## 📋 Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Access to the DayStart project dashboard
- Environment variables configured (see below)

## 🔧 Environment Configuration

### Project References
- **Main Environment**: `project_ref`
- **Develop Environment**: `project_ref`

### Environment Variables Setup

#### Option 1: Use Existing .env File (Recommended)
The project includes a `.env.example` file with the correct structure:

```bash
# Copy and edit the example file
cp .env.example .env

# Edit .env with your actual keys
```

#### Option 2: Create New .env File
Create `.env` with your project details:

```bash
# Supabase Configuration (Development Environment)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_development_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_development_service_role_key
SUPABASE_DEVELOP_PROJECT=project_ref
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_DB_PASSWORD=your_database_password

# Supabase Configuration (Production Environment)
# SUPABASE_URL=your_supabase_url
# SUPABASE_ANON_KEY=your_production_anon_key
# SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
# SUPABASE_MAIN_PROJECT=project_ref
# SUPABASE_ACCESS_TOKEN=your_supabase_access_token
# SUPABASE_DB_PASSWORD=your_database_password

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

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```

### Step 3: Link to Project
```bash
# For develop environment
supabase link --project-ref project_ref

# For production environment
supabase link --project-ref project_ref
```

**What happens:**
- Connects to remote database
- Sets up migration tracking
- May show Docker warnings (ignore for remote-only development)

### Step 4: Verify Connection
```bash
# Check migration sync
supabase migration list

# Test database access (replace with your actual keys)
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 📁 Project Structure

```
supabase/
├── config.toml          # Local development configuration
└── migrations/          # Database migrations
    └── 20240101000000_create_users_table.sql
```

### Example config.toml
```toml
[api]
enabled = true
port = 54321
schemas = ["public", "storage", "graphql_public"]

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true

[auth]
enabled = true
port = 54325
```

## ✅ Connection Verification

### System Status Check
```bash
# Check Supabase status
supabase status

# Check migration status
supabase migration list
```

**Expected Results:**
- ✅ Database tables accessible
- ✅ Environment variables set
- ✅ Migration tracking active

## 🗄️ Database Status

### Current System State (July 2025)
- **Users**: 0+ users (new project)
- **Alarms**: 0+ configured alarms (new project)
- **Migrations**: 1 migration (users table)

### Key Tables
```bash
# Check table counts (after users table is deployed)
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 🚀 Development Workflow

### Branch Strategy
- **main branch**: Production environment (`project_ref`)
- **develop branch**: Development environment (`project_ref`)

### Local Development
1. Work on `develop` branch
2. Use local Supabase instance for testing
3. Push migrations when ready
4. Deploy to develop environment for integration testing

### Production Deployment
1. Merge `develop` to `main`
2. Deploy to production environment
3. Run any necessary migrations

## ⚡ Development Commands

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
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 🔄 How GitHub Integration Works

### **Automatic Deployment Flow**
```
Push to Branch → Supabase Detects Changes → Automatic Deployment
```

### **Branch Mapping**
- `main` branch → Production environment
- `develop` branch → Preview environment  
- `feature/*` branches → Individual preview environments

### **What Gets Deployed**
- **Database migrations** in `supabase/migrations/`
- **Configuration** in `supabase/config.toml`

### **Deployment Triggers**
- **Automatic Triggers**:
  - **Push to main**: Deploys to production
  - **Push to develop**: Deploys to preview
  - **Push to feature branch**: Creates preview environment
- **Manual Triggers**:
  - **Supabase Dashboard**: Manual deployment from UI
  - **Supabase CLI**: `supabase db push`

## 🔍 Troubleshooting

### Common Issues & Quick Fixes

#### **1. "Invalid API key" errors**
```bash
# Ensure both headers are set
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

#### **2. Migration sync issues**
```bash
# Check migration status
supabase migration list

# If migrations are out of sync, repair tracking:
supabase migration repair --status applied <migration_id>
```

#### **3. Connection refused errors**
```bash
# Verify project reference
supabase status

# Re-link to project
supabase link --project-ref project_ref
```

#### **4. Integration Not Working**
- **Check**: GitHub authorization in Supabase dashboard
- **Verify**: Repository access permissions
- **Ensure**: Correct repository selected

#### **5. Deployments Not Triggering**
- **Check**: Branch protection rules
- **Verify**: Supabase directory path is correct
- **Ensure**: Files are in the right location

#### **6. Migrations Not Applying**
- **Check**: Migration files are in `supabase/migrations/`
- **Verify**: Migration naming convention (YYYYMMDDHHMMSS_name.sql)
- **Ensure**: No conflicts with existing migrations

### Debug Commands
```bash
# Check connection status
supabase status

# Validate project setup
supabase projects list

# Check migration status
supabase migration list
```

## 🔐 Security Notes

- **Never commit API keys** to version control
- **Use environment variables** for all sensitive data
- **Project references are documented** but not exposed in public repositories
- **Service role keys** should only be used in secure environments
- **Reference IDs are documented** but not exposed in public repositories

## 📚 Best Practices

### **1. Branch Strategy**
- Use `main` for production
- Use `develop` for staging
- Use `feature/*` for development
- Never push directly to `main`

### **2. Migration Management**
- Always test migrations locally first
- Use descriptive migration names
- Keep migrations small and focused
- Never modify existing migrations

### **4. Security**
- Never commit API keys to repository
- Use environment variables for secrets
- Enable branch protection rules
- Review deployment logs regularly

## 📚 Quick Commands Reference

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy database changes
supabase db push

# Check status
supabase status

# List migrations
supabase migration list
```

## 📚 Next Steps

1. **Deploy the users table** using CI/CD pipeline
2. **Set up iOS app** to connect to Supabase
3. **Configure authentication** flow
4. **Deploy to production** when ready

## 🔗 Useful Links

- [Supabase GitHub Integration Docs](https://supabase.com/docs/guides/platform/github-integration)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Database Migrations Docs](https://supabase.com/docs/guides/cli/migrations)
- [Supabase Documentation](https://supabase.com/docs)

## 🆘 Getting Help

- Check [Supabase Documentation](https://supabase.com/docs)
- Review project logs in Supabase Dashboard
- Check local logs with `supabase logs`
- Check database status in Database section
- Review deployment history in Settings → GitHub

---

*This guide covers the essential steps to set up and connect to Supabase for DayStart development, including local development, GitHub integration, and deployment workflows.* 