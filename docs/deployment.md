# DayStart Deployment Guide

## 🎯 Overview

DayStart uses a dual-environment deployment system with automated CI/CD pipelines:

- **`main` branch** → Production environment (`project_ref`)
- **`develop` branch** → Development environment (`project_ref`)

✅ **Status: Deployment system is fully operational and tested**

## 🚀 Quick Start (5 Minutes)

### 1. **Enable GitHub Integration in Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **GitHub**
4. Click **"Connect GitHub"**
5. Authorize Supabase to access your GitHub repository
6. Select your repository
7. Configure deployment settings:
   - **Supabase directory path**: `supabase`
   - **Production branch**: `main`
   - **Enable automatic branching**: ✅ Checked

### 2. **Configure GitHub Secrets**
Set these secrets in your GitHub repository settings:

#### Production Environment (`main` branch)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
SUPABASE_MAIN_PROJECT=project_ref
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_DB_PASSWORD=your_database_password
```

#### Development Environment (`develop` branch)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_development_service_role_key
SUPABASE_DEVELOP_PROJECT=project_ref
SUPABASE_ACCESS_TOKEN=your_supabase_access_token
SUPABASE_DB_PASSWORD=your_database_password
```

### 3. **Set Up Branch Protection (Recommended)**
In GitHub repository settings:
1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Require pull request reviews
   - ✅ Restrict direct pushes

## 🔄 Deployment Workflow

### Development Workflow
```mermaid
graph LR
    A[Feature Branch] --> B[PR to develop]
    B --> C[CI Checks Pass]
    C --> D[Merge to develop]
    D --> E[Auto Deploy to Develop]
```

**Steps:**
1. Create feature branch from `develop`
2. Make changes and push to feature branch
3. Create PR to `develop` branch
4. CI pipeline runs automatically
5. After approval and merge, automatic deployment to develop environment

### Production Workflow
```mermaid
graph LR
    A[develop] --> B[PR to main]
    B --> C[CI Checks Pass]
    C --> D[Manual Approval]
    D --> E[Merge to main]
    E --> F[Manual Production Deploy]
```

**Steps:**
1. Create PR from `develop` to `main`
2. CI pipeline runs automatically
3. Manual review and approval required
4. Merge to `main` branch
5. Manual production deployment triggered

## 📋 Required Repository Structure

### **Minimum Structure**
```
your-project/
├── .github/
│   └── workflows/          # GitHub Actions
├── supabase/
│   ├── config.toml         # Supabase config
│   └── migrations/         # Database migrations
│       └── 20240101000000_create_users_table.sql
└── README.md
```

## 🚀 Workflow Files

### Production Deployment (`.github/workflows/deploy-main.yml`)
- **Automatic**: Triggers on push to `main` branch
- **Manual**: Workflow dispatch with confirmation dialog
- **Validation**: Branch validation, environment variable checks
- **Health Checks**: Post-deployment verification of database

### Development Deployment (`.github/workflows/deploy-develop.yml`)
- **Automatic**: Triggers on push to `develop` branch
- **Manual**: Workflow dispatch (no confirmation required)
- **Validation**: Environment variable checks
- **Health Checks**: Post-deployment verification of database

## 📊 Deployment Process

### 1. Environment Validation
- Validates all required secrets are present
- Checks branch permissions and working directory state
- Ensures proper environment configuration

### 2. Supabase Deployment
- Links to appropriate Supabase project
- Deploys database migrations
- Sets environment variables

### 3. Health Checks
- Verifies database connectivity via API
- Validates deployment status
- Checks migration file integrity

### 4. Notification
- Success notifications with deployment details
- Failure notifications with rollback guidance

## 🗄️ Database Migrations

### Migration Process
1. Create migration file in `supabase/migrations/`
2. Test locally with `supabase db reset`
3. Push to develop branch
4. Automatic deployment to develop environment
5. Test in develop environment
6. Deploy to production when ready

### Migration Naming
Use timestamp format: `YYYYMMDDHHMMSS_description.sql`

Example: `20240101120000_create_users_table.sql`

## 🔍 Troubleshooting

### Common Issues

#### Missing Environment Variables
```
❌ Missing required environment variable: SUPABASE_URL
```
**Solution**: Add the missing secret to GitHub repository settings

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

# Check migration status
supabase migration list

# Validate project setup
supabase projects list
```

## 📈 Monitoring

### GitHub Actions
- Monitor deployment status in Actions tab
- Check logs for detailed error information
- Review health check results

### Supabase Dashboard
- Check database status in Database section
- Review deployment history in Settings → GitHub

## 🔒 Security Considerations

1. **Never commit secrets** to the repository
2. **Use environment-specific secrets** (PROD/DEV suffixes)
3. **Rotate access tokens** regularly
4. **Review deployment logs** for sensitive information
5. **Enable branch protection** on main branch
6. **Database URLs contain sensitive credentials** - keep them secure

## 🔄 Rollback Procedures

### Database Rollback
1. Create new migration to revert changes
2. Deploy to develop first
3. Test thoroughly
4. Deploy to production

### Emergency Rollback
1. Use Supabase Dashboard to restore from backup
2. Deploy known good migration
3. Verify system stability

## 📚 Best Practices

### 1. Branch Strategy
- Use `main` for production
- Use `develop` for staging
- Use `feature/*` for development
- Never push directly to `main`

### 2. Migration Management
- Always test migrations locally first
- Use descriptive migration names
- Keep migrations small and focused
- Never modify existing migrations

### 3. Security
- Never commit API keys to repository
- Use environment variables for secrets
- Enable branch protection rules
- Review deployment logs regularly

### 4. General
- **Always test in develop first**
- **Use descriptive commit messages**
- **Review PRs thoroughly before merging**
- **Monitor deployments for errors**
- **Keep migration files small and focused**
- **Document breaking changes**
- **Use feature flags for major changes**

## 🔗 Useful Links

- [Supabase GitHub Integration Docs](https://supabase.com/docs/guides/platform/github-integration)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Database Migrations Docs](https://supabase.com/docs/guides/cli/migrations)

---

*This deployment system provides automated, reliable deployments with comprehensive validation and health checks for both development and production environments. For initial setup, see [supabase-setup.md](supabase-setup.md).*
