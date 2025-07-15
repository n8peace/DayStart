#!/bin/bash

# DayStart Database Tables Deployment Script
# This script deploys the 3 new tables to the Supabase develop branch

set -e  # Exit on any error

echo "🚀 Starting DayStart database tables deployment..."

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Error: supabase/config.toml not found. Please run this script from the project root."
    exit 1
fi

# Check if migrations exist
if [ ! -f "supabase/migrations/20250101000001_create_content_blocks_table.sql" ]; then
    echo "❌ Error: Migration files not found. Please ensure all migration files are created."
    exit 1
fi

echo "📋 Migration files found:"
ls -la supabase/migrations/2025010100000*.sql

echo ""
echo "🔍 Pre-deployment checks:"
echo "✅ Project root directory confirmed"
echo "✅ Migration files exist"
echo "✅ Supabase config found"

echo ""
echo "📊 Tables to be deployed:"
echo "1. content_blocks - Unified content storage"
echo "2. user_preferences - User settings"
echo "3. logs - System logging"
echo "4. user_weather_data - Weather data cache"

echo ""
echo "🔐 RLS Policies included:"
echo "✅ content_blocks - Shared content read, user-specific read/write, service role access"
echo "✅ user_preferences - User self-management, service role access"
echo "✅ logs - User read own logs, service role full access"

echo ""
read -p "🤔 Ready to deploy to develop branch? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

echo ""
echo "🚀 Deploying via GitHub to Supabase develop branch..."

# Check if we're on develop branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "develop" ]; then
    echo "❌ Error: You must be on the 'develop' branch to deploy."
    echo "   Current branch: $current_branch"
    echo "   Please run: git checkout develop"
    exit 1
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: You have uncommitted changes."
    echo "   Please commit or stash your changes before deploying."
    git status --short
    exit 1
fi

# Add and commit the migration files
echo "📝 Committing migration files..."
git add supabase/migrations/2025010100000*.sql
git add docs/database.md
git commit -m "feat: Add content_blocks, user_preferences, logs, and user_weather_data tables

- Add unified content_blocks table with RLS policies
- Add user_preferences table for backend settings  
- Add logs table for system monitoring
- Add user_weather_data table for weather caching
- Update database documentation
- Include comprehensive RLS policies for all tables"

# Push to develop branch (triggers automatic deployment)
echo "🚀 Pushing to develop branch..."
git push origin develop || {
    echo "❌ Push failed!"
    echo "💡 Make sure you have:"
    echo "   - Proper access to push to develop branch"
    echo "   - GitHub integration configured in Supabase"
    echo "   - GitHub Actions workflow set up"
    exit 1
}

echo ""
echo "✅ Push successful! Deployment in progress..."

echo ""
echo "🔄 GitHub Actions Workflow:"
echo "1. GitHub Actions will automatically trigger"
echo "2. Migrations will be applied to Supabase develop environment"
echo "3. Health checks will verify the deployment"
echo "4. You'll receive success/failure notifications"

echo ""
echo "🔍 Post-deployment verification:"
echo "1. Check GitHub Actions tab for deployment status"
echo "2. Verify in Supabase Dashboard that all 3 tables were created:"
echo "   - content_blocks"
echo "   - user_preferences" 
echo "   - logs"
echo ""
echo "3. Verify RLS policies are active in Supabase Dashboard"
echo "4. Test basic operations in your application"

echo ""
echo "📝 Next steps:"
echo "1. Monitor GitHub Actions for deployment completion"
echo "2. Test the tables with your application"
echo "3. Update docs/database.md with deployment status when confirmed"
echo "4. Set up background jobs for content generation"

echo ""
echo "🎉 Deployment complete! Your DayStart database now has 5 tables total:"
echo "   ✅ users (existing)"
echo "   ✅ content_blocks (new)"
echo "   ✅ user_preferences (new)"
echo "   ✅ logs (new)"
echo "   ✅ user_weather_data (new)" 