# DayStart Development Guide

## 🎯 Overview

This guide covers the development workflow, best practices, and contribution guidelines for DayStart. It focuses on the development process, code standards, and team collaboration.

## 🔄 Development Workflow

### Branch Strategy
- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: Individual feature branches
- **`hotfix/*`**: Emergency fixes for production

### Development Process
1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Implement Feature**
   - Write code following project standards
   - Add tests if applicable
   - Update documentation as needed

3. **Test Locally**
   ```bash
   # Test database changes
   supabase db reset
   supabase db push
   
   # Test edge functions
   supabase functions serve
   ```

4. **Create Pull Request**
   - Target `develop` branch
   - Include clear description of changes
   - Reference any related issues

5. **Code Review**
   - Address review comments
   - Ensure CI checks pass
   - Get approval from maintainers

6. **Merge and Deploy**
   - Merge to `develop`
   - Automatic deployment to development environment
   - Test in development environment

7. **Release to Production**
   - Create PR from `develop` to `main`
   - Manual review and approval
   - Deploy to production

## 📋 Code Standards

### **1. Commit Messages**
Use conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build/tooling changes

**Examples:**
```bash
feat(auth): add user authentication flow
fix(db): resolve migration conflict
docs(setup): update environment configuration
```

### **2. Database Migrations**
- Use descriptive names: `YYYYMMDDHHMMSS_description.sql`
- Keep migrations small and focused
- Never modify existing migrations
- Test locally before committing
- **NEVER migrate directly to Supabase** - all changes must go through GitHub workflow
- Deploy via GitHub Actions to develop/main branches only

**Example:**
```sql
-- 20240101120000_create_users_table.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### **3. Edge Functions**
- Use TypeScript for type safety
- Include error handling
- Add input validation
- Document function purpose

**Example:**
```typescript
// example-function/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { user_id, preferences } = await req.json()
    
    // Validate input
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400 }
      )
    }
    
    // Function logic here
    
    return new Response(
      JSON.stringify({ message: "Function response" }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

## 🧪 Testing

### **1. Database Testing**
```bash
# Test migrations locally
supabase db reset
supabase db push

# Verify data integrity
supabase db diff
```

### **2. Edge Function Testing**
```bash
# Start local functions
supabase functions serve

# Test function
curl -X POST http://localhost:54321/functions/v1/example-function \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "preferences": {}}'
```

### **3. Integration Testing**
- Test complete workflows
- Verify API responses
- Check error handling
- Validate data consistency

## 📁 Project Structure

```
DayStart/
├── supabase/              # Backend configuration
│   ├── functions/         # Edge functions
│   │   ├── generate-script/      # Script generation
│   │   ├── generate-audio/       # Audio generation (NEW)
│   │   ├── generate-*-content/   # Content generation functions
│   │   └── ...
│   ├── migrations/        # Database migrations
│   └── config.toml        # Supabase configuration
├── docs/                  # Documentation
├── .github/               # GitHub Actions
└── README.md              # Project overview
```

## 🔧 Development Tools

### **1. Supabase CLI**
```bash
# Install globally
npm install -g supabase

# Start local development
supabase start

# Stop local development
supabase stop

# View logs
supabase logs
```



### **3. Environment Management**
```bash
# Copy environment template
cp .env.example .env

# Edit with your keys
# See supabase-setup.md for details
```

## 🤝 Contributing

### **1. Before Contributing**
- Read the project documentation
- Understand the tech stack
- Set up local development environment
- Review existing issues and PRs

### **2. Making Changes**
- Create feature branch from `develop`
- Follow code standards
- Add tests for new functionality
- Update documentation as needed

### **3. Pull Request Process**
- Clear description of changes
- Reference related issues
- Include screenshots for UI changes
- Ensure all CI checks pass

### **4. Review Process**
- Code review by maintainers
- Address feedback promptly
- Keep PRs focused and small
- Respond to review comments

## 📚 Best Practices

### **1. Development**
- **Always test locally first**
- **Use descriptive commit messages**
- **Keep PRs small and focused**
- **Document breaking changes**
- **Follow established patterns**

### **2. Database**
- **Test migrations locally**
- **Use descriptive migration names**
- **Keep migrations small**
- **Never modify existing migrations**
- **Backup before major changes**

### **3. Security**
- **Never commit secrets**
- **Use environment variables**
- **Validate all inputs**
- **Handle errors gracefully**
- **Review security implications**

### **4. Performance**
- **Optimize database queries**
- **Use appropriate indexes**
- **Monitor function performance**
- **Cache when appropriate**
- **Profile before optimizing**

## 🔍 Code Review Checklist

### **Functionality**
- [ ] Does the code work as intended?
- [ ] Are edge cases handled?
- [ ] Is error handling appropriate?
- [ ] Are inputs validated?

### **Code Quality**
- [ ] Is the code readable and well-structured?
- [ ] Are functions small and focused?
- [ ] Is there appropriate documentation?
- [ ] Are naming conventions followed?

### **Security**
- [ ] Are inputs sanitized?
- [ ] Are secrets properly handled?
- [ ] Are permissions appropriate?
- [ ] Are there any security vulnerabilities?

### **Testing**
- [ ] Are tests included for new functionality?
- [ ] Do existing tests still pass?
- [ ] Is test coverage adequate?
- [ ] Are edge cases tested?

## 🚀 Deployment Checklist

### **Before Deploying**
- [ ] All tests pass locally
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Environment variables configured
- [ ] Database migrations tested

### **After Deploying**
- [ ] Verify deployment success
- [ ] Check health endpoints
- [ ] Test critical functionality
- [ ] Monitor for errors
- [ ] Update deployment log

## 📊 Monitoring and Debugging

### **1. Local Debugging**
```bash
# View Supabase logs
supabase logs

# Check database status
supabase status

# Monitor API calls
supabase functions serve --debug
```

### **2. Production Monitoring**
- GitHub Actions logs
- Supabase dashboard metrics
- Error tracking and alerting
- Performance monitoring

## 🔗 Useful Resources

- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

*This development guide provides the foundation for contributing to DayStart. For setup instructions, see [supabase-setup.md](supabase-setup.md). For deployment workflows, see [deployment.md](deployment.md).* 