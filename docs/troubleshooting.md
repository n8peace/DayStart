# DayStart Troubleshooting Guide

## 🎯 Overview

This guide covers common issues and solutions for DayStart development and deployment. Issues are organized by category for easy navigation.

## 🔧 Setup Issues

### **1. "Invalid API key" errors**
```bash
# Ensure both headers are set
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Common Causes:**
- Missing Authorization header
- Incorrect service role key
- Expired access token

**Solution:**
1. Verify your service role key in Supabase dashboard
2. Ensure both `apikey` and `Authorization` headers are set
3. Check if your access token is still valid

### **2. Migration sync issues**
```bash
# Check migration status
supabase migration list

# If migrations are out of sync, repair tracking:
supabase migration repair --status applied <migration_id>
```

**Common Causes:**
- Local and remote migrations out of sync
- Failed migration deployment
- Manual database changes

**Solution:**
1. Check migration status with `supabase migration list`
2. Repair tracking if needed
3. Reset local database if necessary: `supabase db reset`

### **3. Connection refused errors**
```bash
# Verify project reference
supabase status

# Re-link to project
supabase link --project-ref project_ref
```

**Common Causes:**
- Incorrect project reference
- Network connectivity issues
- Supabase service downtime

**Solution:**
1. Verify project reference is correct
2. Check network connectivity
3. Re-link to project if needed

## 🚀 Deployment Issues

### **1. Missing Environment Variables**
```
❌ Missing required environment variable: SUPABASE_URL
```

**Solution**: 
1. Add the missing secret to GitHub repository settings
2. Verify secret name matches exactly (case-sensitive)
3. Check if secret is available for the correct branch

### **2. Database Connectivity Issues**
```
⚠️ Database connectivity check failed (HTTP 401)
```

**Solution**: 
1. Verify service role key is correct
2. Check if users table exists
3. Verify RLS policies are configured correctly
4. Ensure database password is correct

### **3. Project Linking Failures**
```
Error: Project not found
```

**Solution**:
1. Verify project reference is correct
2. Check Supabase access token has proper permissions
3. Ensure project exists and is accessible
4. Verify you're using the correct environment (dev/prod)

### **4. Integration Not Working**
- **Check**: GitHub authorization in Supabase dashboard
- **Verify**: Repository access permissions
- **Ensure**: Correct repository selected

### **5. Deployments Not Triggering**
- **Check**: Branch protection rules
- **Verify**: Supabase directory path is correct
- **Ensure**: Files are in the right location

### **6. Migrations Not Applying**
- **Check**: Migration files are in `supabase/migrations/`
- **Verify**: Migration naming convention (YYYYMMDDHHMMSS_name.sql)
- **Ensure**: No conflicts with existing migrations

## 🔍 Debug Commands

### **Connection Verification**
```bash
# Check Supabase CLI status
supabase status

# Check migration status
supabase migration list

# Validate project setup
supabase projects list

# Test database connection
curl -s "your_supabase_url/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

### **Environment Validation**
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
echo $SUPABASE_ACCESS_TOKEN

# Verify project linking
supabase status
```

### **Migration Debugging**
```bash
# List all migrations
supabase migration list

# Check migration status
supabase migration status

# Repair migration tracking
supabase migration repair --status applied <migration_id>
```

## 🔄 Rollback Procedures

### **Database Rollback**
1. Create new migration to revert changes
2. Deploy to develop first
3. Test thoroughly
4. Deploy to production

### **Emergency Rollback**
1. Use Supabase Dashboard to restore from backup
2. Deploy known good migration
3. Verify system stability

## 📱 iOS Development Issues

*Note: iOS development has not yet begun. This section will be populated when iOS app development starts.*

### **Common iOS Issues (Future)**
- Build configuration problems
- Signing and provisioning issues
- Supabase client integration
- Audio playback problems
- Background app refresh

## 🔐 Security Issues

### **1. Exposed API Keys**
**Problem**: API keys committed to repository

**Solution**:
1. Immediately rotate the exposed keys
2. Remove keys from git history
3. Use environment variables going forward
4. Enable branch protection rules

### **2. Unauthorized Access**
**Problem**: Unauthorized access to database

**Solution**:
1. Review RLS policies
2. Check service role key permissions
3. Verify authentication flow
4. Audit access logs

## 📊 Monitoring and Logs

### **GitHub Actions**
- Monitor deployment status in Actions tab
- Check logs for detailed error information
- Review health check results

### **Supabase Dashboard**
- Check database status in Database section
- Review deployment history in Settings → GitHub
- Monitor API usage and performance

### **Local Development**
```bash
# View Supabase logs
supabase logs

# Check local status
supabase status

# Monitor database
supabase db diff
```

## 🆘 Getting Help

### **1. Check Documentation**
- Review [supabase-setup.md](supabase-setup.md) for setup issues
- Review [deployment.md](deployment.md) for deployment issues
- Check [development.md](development.md) for workflow issues

### **2. External Resources**
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

### **3. Project-Specific Help**
- Check project logs in Supabase Dashboard
- Review GitHub Actions logs
- Check local logs with `supabase logs`

## 📚 Best Practices

### **1. Prevention**
- Always test locally before deploying
- Use descriptive commit messages
- Review PRs thoroughly before merging
- Keep migration files small and focused

### **2. Debugging**
- Start with the simplest possible test
- Check logs first before making changes
- Use API-based verification over Docker commands
- Document any workarounds you discover

### **3. Security**
- Never commit secrets to repository
- Use environment variables for all sensitive data
- Rotate access tokens regularly
- Enable branch protection rules

---

*This troubleshooting guide covers the most common issues encountered during DayStart development and deployment. For specific setup instructions, see [supabase-setup.md](supabase-setup.md).* 