# Deployment Secrets Configuration

This document outlines the GitHub secrets required for successful deployment to Supabase environments.

## Required Secrets

### For All Environments
- `SUPABASE_ACCESS_TOKEN`: Your Supabase access token for authentication
- `SUPABASE_DEVELOP_PROJECT`: Project reference ID for the develop environment
- `SUPABASE_MAIN_PROJECT`: Project reference ID for the production environment

### For Database Deployments
- `SUPABASE_DEVELOP_DB_URL`: Direct database connection URL for develop environment
- `SUPABASE_MAIN_DB_URL`: Direct database connection URL for production environment

## How to Get These Values

### 1. Supabase Access Token
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/account/tokens)
2. Click "Generate new token"
3. Give it a name (e.g., "DayStart CI/CD")
4. Copy the token and add it to GitHub secrets

### 2. Project References
1. Go to your Supabase project dashboard
2. Click on "Settings" → "General"
3. Copy the "Reference ID" (format: `abcdefghijklmnopqrst`)
4. Add to GitHub secrets as `SUPABASE_DEVELOP_PROJECT` or `SUPABASE_MAIN_PROJECT`

### 3. Database URLs
1. Go to your Supabase project dashboard
2. Click on "Settings" → "Database"
3. Scroll down to "Connection string"
4. Select "URI" format
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with your database password
7. Add to GitHub secrets as `SUPABASE_DEVELOP_DB_URL` or `SUPABASE_MAIN_DB_URL`

## Example Database URL Format
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

## Security Notes
- Never commit these secrets to the repository
- Use different secrets for develop and production environments
- Rotate access tokens regularly
- Database URLs contain sensitive credentials - keep them secure

## Troubleshooting

### SASL Authentication Error
If you see "failed SASL auth" errors:
1. Verify the database URL is correct
2. Ensure the password in the URL is correct
3. Check that the project reference matches the database URL
4. Verify the access token has proper permissions

### Project Linking Issues
If you see "Local config differs from linked project":
1. This is usually a warning and can be ignored
2. The deployment will still work with the correct project reference
3. The local config is for development, not deployment

## Current Status
- ✅ Develop environment: Configured with separate project and database
- ✅ Production environment: Configured with separate project and database
- ✅ CI/CD pipeline: Updated to use direct database URLs
- ✅ Security: All secrets stored in GitHub environment secrets 