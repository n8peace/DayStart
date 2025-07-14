# Deployment Guide

## Overview

DayStart uses a multi-environment deployment strategy with automated CI/CD pipelines:

- **Develop Environment**: `epqiarnkhzabggxiltci` - Automatic deployment on develop branch
- **Production Environment**: `yqbrfznixefqqhnvingu` - Manual deployment from main branch

## Deployment Workflow

### 1. Development Workflow

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

### 2. Production Workflow

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

## CI/CD Pipeline

### Automated Jobs

#### iOS CI
- **Trigger**: All pushes and PRs
- **Actions**:
  - Build iOS app with Xcode
  - Run unit tests
  - Validate project structure

#### Supabase CI
- **Trigger**: All pushes and PRs
- **Actions**:
  - Validate Supabase configuration
  - Check migration syntax
  - Lint database schema

#### Security Checks
- **Trigger**: All pushes and PRs
- **Actions**:
  - Scan for secrets in code
  - Check for large files
  - Validate project structure

### Deployment Jobs

#### Develop Deployment
- **Trigger**: Push to `develop` branch
- **Actions**:
  - Deploy database migrations
  - Deploy Edge Functions
  - Update develop environment

#### Production Deployment
- **Trigger**: Manual workflow dispatch
- **Actions**:
  - Validate deployment request
  - Deploy to production environment
  - Verify deployment success

## Environment Configuration

### GitHub Secrets Required

Set these secrets for each environment in your GitHub repository settings:

#### Develop Environment Secrets
```bash
SUPABASE_ACCESS_TOKEN=your_develop_access_token
SUPABASE_URL=https://epqiarnkhzabggxiltci.supabase.co
SUPABASE_ANON_KEY=your_develop_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_develop_service_role_key
SUPABASE_DEVELOP_PROJECT=your_supabase_develop_project
```

#### Production Environment Secrets
```bash
SUPABASE_ACCESS_TOKEN=your_production_access_token
SUPABASE_URL=https://yqbrfznixefqqhnvingu.supabase.co
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
SUPABASE_MAIN_PROJECT=your_supabase_main_project
```

### Environment Variables

Each environment uses different Supabase project references:

```env
# Develop Environment
SUPABASE_URL=https://epqiarnkhzabggxiltci.supabase.co

# Production Environment  
SUPABASE_URL=https://yqbrfznixefqqhnvingu.supabase.co
```

## Manual Production Deployment

### Prerequisites
- Must be on `main` branch
- Working directory must be clean
- All CI checks must pass

### Steps
1. Go to GitHub Actions tab
2. Select "Manual Production Deployment" workflow
3. Click "Run workflow"
4. Select "production" environment
5. Check "Confirm deployment" checkbox
6. Click "Run workflow"

### Validation
The workflow will:
- Validate you're on main branch
- Check for uncommitted changes
- Verify environment selection
- Deploy database migrations
- Deploy Edge Functions
- Verify deployment success

## Database Migrations

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

## Edge Functions

### Deployment Process
1. Update function code in `supabase/functions/`
2. Push to develop branch
3. Automatic deployment to develop environment
4. Test function endpoints
5. Deploy to production when ready

### Function Structure
```
supabase/functions/
├── generate-message/
│   └── index.ts
└── test-voice/
    └── index.ts
```

## Monitoring & Troubleshooting

### Deployment Logs
- View logs in GitHub Actions
- Check Supabase Dashboard for function logs
- Monitor database migrations in Supabase

### Common Issues

#### Migration Failures
- Check SQL syntax in migration files
- Verify RLS policies
- Check for conflicting migrations

#### Function Deployment Issues
- Verify TypeScript compilation
- Check function dependencies
- Review function logs in Supabase Dashboard

#### iOS Build Failures
- Check Xcode project configuration
- Verify Swift Package dependencies
- Review build logs for specific errors

## Rollback Procedures

### Database Rollback
1. Create new migration to revert changes
2. Deploy to develop first
3. Test thoroughly
4. Deploy to production

### Function Rollback
1. Revert function code changes
2. Deploy previous version
3. Verify functionality

### Emergency Rollback
1. Use Supabase Dashboard to restore from backup
2. Deploy known good migration
3. Verify system stability

## Security Considerations

- All deployments require proper authentication
- Production deployments require manual approval
- Secrets are stored in GitHub Secrets
- RLS policies protect data access
- Environment-specific configurations prevent cross-contamination

## Best Practices

1. **Always test in develop first**
2. **Use descriptive commit messages**
3. **Review PRs thoroughly before merging**
4. **Monitor deployments for errors**
5. **Keep migration files small and focused**
6. **Document breaking changes**
7. **Use feature flags for major changes**
