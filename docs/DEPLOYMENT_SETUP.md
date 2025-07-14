# Deployment Setup Guide

## 🎯 Overview

This project uses a dual-environment deployment system with automatic deployments triggered by branch pushes:

- **`main` branch** → Production environment
- **`develop` branch** → Development environment

## 📋 Required GitHub Secrets

### Production Environment (`main` branch)
```bash
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
SUPABASE_MAIN_PROJECT=your-production-project-ref
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
```

### Development Environment (`develop` branch)
```bash
SUPABASE_URL_DEV=https://your-development-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=your-development-service-role-key
SUPABASE_DEV_PROJECT_REF=your-development-project-ref
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
```

## 🔄 Deployment Triggers

### Automatic Deployments
- **Push to `main`** → Automatic production deployment
- **Push to `develop`** → Automatic development deployment

### Manual Deployments
- **Production**: Manual trigger via GitHub Actions with confirmation
- **Development**: Manual trigger via GitHub Actions (no confirmation required)

## 🚀 Workflow Files

### Production Deployment (`.github/workflows/deploy.yml`)
- **Automatic**: Triggers on push to `main` branch
- **Manual**: Workflow dispatch with confirmation dialog
- **Validation**: Branch validation, environment variable checks
- **Health Checks**: Post-deployment verification of functions and database

### Development Deployment (`.github/workflows/deploy-develop.yml`)
- **Automatic**: Triggers on push to `develop` branch
- **Manual**: Workflow dispatch (no confirmation required)
- **Validation**: Environment variable checks
- **Health Checks**: Post-deployment verification of functions and database

## 📊 Deployment Process

### 1. Environment Validation
- Validates all required secrets are present
- Checks branch permissions and working directory state
- Ensures proper environment configuration

### 2. Supabase Deployment
- Links to appropriate Supabase project
- Deploys database migrations
- Deploys edge functions
- Sets environment variables

### 3. Health Checks
- Tests edge function endpoints
- Verifies database connectivity
- Validates deployment status

### 4. Notification
- Success notifications with deployment details
- Failure notifications with rollback guidance

## 🔧 Setup Instructions

### 1. Create Supabase Projects
1. Create production project in Supabase dashboard
2. Create development project in Supabase dashboard
3. Note the project references for each

### 2. Get Supabase Access Token
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to Account → Access Tokens
3. Generate a new access token

### 3. Get Service Role Keys
1. In each Supabase project dashboard
2. Go to Settings → API
3. Copy the "service_role" key (not the anon key)

### 4. Configure GitHub Secrets
1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add all required secrets with exact names

### 5. Test Deployments
1. Push to `develop` branch to test development deployment
2. Push to `main` branch to test production deployment
3. Check GitHub Actions logs for any issues

## 🏥 Health Check Endpoints

The deployment workflows test these endpoints:

### Edge Functions
- `GET /functions/v1/generate-message`
- `GET /functions/v1/test-voice`

### Database
- `GET /rest/v1/users?select=count`

## 🔍 Troubleshooting

### Common Issues

#### Missing Environment Variables
```
❌ Missing required environment variable: SUPABASE_URL
```
**Solution**: Add the missing secret to GitHub repository settings

#### Function Health Check Failures
```
❌ generate-message function health check failed (HTTP 404)
```
**Solution**: 
1. Check if function exists in `supabase/functions/`
2. Verify function deployment completed
3. Check function logs in Supabase dashboard

#### Database Connectivity Issues
```
⚠️ Database connectivity check failed (HTTP 401)
```
**Solution**: 
1. Verify service role key is correct
2. Check if users table exists
3. Verify RLS policies are configured correctly

#### Project Linking Failures
```
Error: Project not found
```
**Solution**:
1. Verify project reference is correct
2. Check Supabase access token has proper permissions
3. Ensure project exists and is accessible

### Debug Commands

```bash
# Check Supabase CLI status
supabase status

# List deployed functions
supabase functions list

# View function logs
supabase functions logs generate-message

# Check migration status
supabase migration list

# Test function locally
supabase functions serve generate-message
```

## 📈 Monitoring

### GitHub Actions
- Monitor deployment status in Actions tab
- Check logs for detailed error information
- Review health check results

### Supabase Dashboard
- Monitor function logs in Edge Functions section
- Check database status in Database section
- Review deployment history in Settings → GitHub

## 🔒 Security Considerations

1. **Never commit secrets** to the repository
2. **Use environment-specific secrets** (PROD/DEV suffixes)
3. **Rotate access tokens** regularly
4. **Review deployment logs** for sensitive information
5. **Enable branch protection** on main branch

## 📚 Related Documentation

- [Supabase GitHub Integration Guide](docs/GITHUB_SUPABASE_CONNECTION_GUIDE.md)
- [Supabase Setup Guide](docs/supabase-setup.md)
- [Architecture Documentation](docs/architecture.md)

---

*This deployment system provides automated, reliable deployments with comprehensive validation and health checks for both development and production environments.* 