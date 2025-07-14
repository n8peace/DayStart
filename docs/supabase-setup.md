# Supabase Setup Guide

## Project Overview

DayStart uses Supabase as the backend service for:
- **Authentication**: User signup/login
- **Database**: PostgreSQL for user data, preferences, and alarm settings
- **Edge Functions**: AI message generation and voice synthesis
- **Storage**: Audio files and user assets
- **Real-time**: Live updates for alarm status

## Environment Configuration

### Project References
- **Main Environment**: `yqbrfznixefqqhnvingu`
- **Develop Environment**: `epqiarnkhzabggxiltci`

### Local Development Setup

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to your project**
   ```bash
   cd supabase
   supabase link --project-ref [PROJECT_REF]
   ```

4. **Start local development**
   ```bash
   supabase start
   ```

### Environment Variables

Update your `.env` file with the appropriate project reference:

```env
# For main environment
SUPABASE_URL=https://yqbrfznixefqqhnvingu.supabase.co
SUPABASE_ANON_KEY=[your_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[your_service_role_key]

# For develop environment  
SUPABASE_URL=https://epqiarnkhzabggxiltci.supabase.co
SUPABASE_ANON_KEY=[your_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[your_service_role_key]
```

## Project Structure

```
supabase/
├── config.toml          # Local development configuration
├── functions/           # Edge Functions
│   ├── generate-message/ # AI message generation
│   └── test-voice/      # Voice synthesis testing
└── migrations/          # Database migrations (to be added)
```

## Development Workflow

### Branch Strategy
- **main branch**: Production environment (`yqbrfznixefqqhnvingu`)
- **develop branch**: Development environment (`epqiarnkhzabggxiltci`)

### Local Development
1. Work on `develop` branch
2. Use local Supabase instance for testing
3. Push migrations and functions when ready
4. Deploy to develop environment for integration testing

### Production Deployment
1. Merge `develop` to `main`
2. Deploy to production environment
3. Run any necessary migrations

## Security Notes

- **Never commit API keys** to version control
- **Use environment variables** for all sensitive data
- **Reference IDs are documented** but not exposed in public repositories
- **Service role keys** should only be used in secure environments

## Next Steps

1. Set up local Supabase CLI
2. Configure environment variables
3. Initialize database schema (when ready)
4. Deploy Edge Functions
5. Test authentication flow

## Troubleshooting

### Common Issues
- **Connection errors**: Verify project reference and API keys
- **CLI not found**: Ensure Supabase CLI is installed globally
- **Permission errors**: Check service role key permissions

### Getting Help
- Check [Supabase Documentation](https://supabase.com/docs)
- Review project logs in Supabase Dashboard
- Check local logs with `supabase logs`
