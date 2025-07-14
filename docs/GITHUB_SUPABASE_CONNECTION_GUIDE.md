# GitHub to Supabase Connection Guide

## 🎯 Quick Setup (5 Minutes)

### 1. **Enable GitHub Integration in Supabase**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **GitHub**
4. Click **"Connect GitHub"**
5. Authorize Supabase to access your GitHub repository
6. Select your repository
7. Configure deployment settings:
   - **Supabase directory path**: `supabase` (or your custom path)
   - **Production branch**: `main`
   - **Enable automatic branching**: ✅ Checked

### 2. **Configure Branch Strategy**
```bash
# Your repository structure should be:
your-project/
├── .github/
│   └── workflows/          # GitHub Actions (optional)
├── supabase/
│   ├── functions/          # Edge Functions
│   ├── migrations/         # Database migrations
│   └── config.toml         # Supabase config
└── README.md
```

### 3. **Set Up Branch Protection (Recommended)**
In GitHub repository settings:
1. Go to **Settings** → **Branches**
2. Add rule for `main` branch:
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date
   - ✅ Require pull request reviews
   - ✅ Restrict direct pushes

## 🔄 How It Works

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
- **Edge functions** in `supabase/functions/`
- **Configuration** in `supabase/config.toml`

## 📋 Required Repository Structure

### **Minimum Structure**
```
supabase/
├── config.toml
├── functions/
│   └── your-function/
│       └── index.ts
└── migrations/
    └── 20250101000000_initial_migration.sql
```

### **Example config.toml**
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

## 🚀 Deployment Triggers

### **Automatic Triggers**
- **Push to main**: Deploys to production
- **Push to develop**: Deploys to preview
- **Push to feature branch**: Creates preview environment

### **Manual Triggers**
- **Supabase Dashboard**: Manual deployment from UI
- **Supabase CLI**: `supabase db push` and `supabase functions deploy`

## 🔧 Environment Variables

### **Setting Environment Variables**
1. **Supabase Dashboard**: Settings → Edge Functions → Environment variables
2. **GitHub Secrets**: For CI/CD workflows (optional)

### **Required Variables for Functions**
```bash
# Core Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Your API keys
OPENAI_API_KEY=your-openai-key
OTHER_API_KEY=your-other-key
```

## 📊 Monitoring Deployments

### **Check Deployment Status**
1. **Supabase Dashboard**: Settings → GitHub → View deployment history
2. **GitHub Actions**: If using CI/CD workflows
3. **Function Logs**: Edge Functions → Your Function → Logs

### **Deployment Logs**
```bash
# Check function deployment status
supabase functions list

# View function logs
supabase functions logs your-function-name

# Check migration status
supabase migration list
```

## 🔍 Troubleshooting

### **Common Issues**

#### **1. Integration Not Working**
- **Check**: GitHub authorization in Supabase dashboard
- **Verify**: Repository access permissions
- **Ensure**: Correct repository selected

#### **2. Deployments Not Triggering**
- **Check**: Branch protection rules
- **Verify**: Supabase directory path is correct
- **Ensure**: Files are in the right location

#### **3. Functions Not Deploying**
- **Check**: Function structure is correct
- **Verify**: Environment variables are set
- **Ensure**: No syntax errors in function code

#### **4. Migrations Not Applying**
- **Check**: Migration files are in `supabase/migrations/`
- **Verify**: Migration naming convention (YYYYMMDDHHMMSS_name.sql)
- **Ensure**: No conflicts with existing migrations

### **Debug Commands**
```bash
# Check connection status
supabase status

# Validate project setup
supabase projects list

# Check function deployment
supabase functions list

# View recent logs
supabase functions logs --follow
```

## 🎯 Best Practices

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

### **3. Function Development**
- Test functions locally before pushing
- Set environment variables before deployment
- Use proper error handling
- Monitor function logs

### **4. Security**
- Never commit API keys to repository
- Use environment variables for secrets
- Enable branch protection rules
- Review deployment logs regularly

## 📚 Quick Commands Reference

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy

# Deploy database changes
supabase db push

# Check status
supabase status

# View logs
supabase functions logs

# List functions
supabase functions list

# List migrations
supabase migration list
```

## 🔗 Useful Links

- [Supabase GitHub Integration Docs](https://supabase.com/docs/guides/platform/github-integration)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Database Migrations Docs](https://supabase.com/docs/guides/cli/migrations)

---

*This guide covers the essential steps to connect GitHub to Supabase for automatic deployments. The integration handles database migrations, edge functions, and configuration changes automatically when you push to your configured branches.* 