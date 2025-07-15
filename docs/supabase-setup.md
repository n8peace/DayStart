# DayStart Supabase Setup Guide

## 🎯 Project Overview

DayStart uses Supabase as the backend service for:
- **Authentication**: User signup/login
- **Database**: PostgreSQL for user data, preferences, and alarm settings
- **Storage**: Audio files and user assets
- **Real-time**: Live updates for alarm status

## 🚀 Quick Start (5 Minutes)

### 1. **Install Prerequisites**
```bash
# Install Supabase CLI
npm install -g supabase

# Verify installation
which supabase
```

### 2. **Link to Project**
```bash
# Login to Supabase
supabase login

# Link to development environment
supabase link --project-ref project_ref

# Verify connection
supabase status
```

### 3. **Configure Environment**
```bash
# Copy environment template
cp .env.example .env

# Edit with your actual keys
# See Environment Configuration section below
```

### 4. **Test Setup**
```bash
# Check migration status
supabase migration list

# Test database connection
supabase status
```

## 🔧 Environment Configuration

### Project References
- **Development Environment**: `project_ref`
- **Production Environment**: `project_ref`

### Environment Variables

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

## 📁 Project Structure

```
supabase/
├── config.toml          # Local development configuration
├── functions/           # Edge functions
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

## 🗄️ Database Status

### Current System State
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

### Local Development
```bash
# Start local Supabase instance
supabase start

# Stop local instance
supabase stop

# View logs
supabase logs
```

### Testing
```bash
# Test database connection
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

## 🔐 Security Notes

- **Never commit API keys** to version control
- **Use environment variables** for all sensitive data
- **Project references are documented** but not exposed in public repositories
- **Service role keys** should only be used in secure environments

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

## 🔗 Useful Links

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Database Migrations Docs](https://supabase.com/docs/guides/cli/migrations)
- [Supabase Documentation](https://supabase.com/docs)

---

*This guide covers the essential steps to set up and connect to Supabase for DayStart development. For deployment workflows, see [deployment.md](deployment.md).* 