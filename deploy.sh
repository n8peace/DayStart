#!/bin/bash

# DayStart Deployment Script
# This script automates the deployment process to ensure reliable deployments

set -e  # Exit on any error

echo "🚀 DayStart Deployment Script"
echo "=============================="

# Check if we're on the develop branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "❌ Error: You must be on the develop branch to deploy"
    echo "Current branch: $CURRENT_BRANCH"
    echo "Please run: git checkout develop"
    exit 1
fi

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: You have uncommitted changes"
    echo "Please commit your changes first:"
    echo "  git add ."
    echo "  git commit -m 'Your commit message'"
    exit 1
fi

# Check if we're up to date with remote
git fetch origin
LOCAL_COMMIT=$(git rev-parse HEAD)
REMOTE_COMMIT=$(git rev-parse origin/develop)

if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
    echo "❌ Error: Your local develop branch is not up to date with remote"
    echo "Please pull the latest changes: git pull origin develop"
    exit 1
fi

echo "✅ Pre-deployment checks passed"
echo "📤 Pushing to develop branch..."

# Push to develop
git push origin develop

echo "✅ Code pushed to develop branch"
echo "🚀 Triggering manual deployment..."

# Trigger manual deployment
gh workflow run "Deploy to Development" --ref develop

echo "✅ Deployment triggered successfully!"
echo ""
echo "📊 Monitor deployment progress:"
echo "   https://github.com/n8peace/DayStart/actions"
echo ""
echo "🔍 Check Supabase function logs:"
echo "   https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/functions"
echo ""
echo "🎉 Deployment initiated! Check the GitHub Actions tab for progress." 