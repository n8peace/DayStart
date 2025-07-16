# Health Check Function

This Supabase Edge Function provides comprehensive system monitoring for the DayStart application, checking database health, content pipeline status, external API connectivity, and more.

## Overview

The `health-check` function monitors the entire DayStart system and sends detailed email reports about system health. It's designed to be run via cron job to provide regular system status updates.

## Features

### Health Checks Performed

1. **Database Connectivity**
   - Tests Supabase connection
   - Verifies table accessibility
   - Checks RLS policy functionality

2. **Content Pipeline Health**
   - Monitors content_blocks status distribution
   - Detects stuck content (long-running states)
   - Calculates failure rates
   - Tracks content expiration patterns

3. **Recent Error Analysis**
   - Analyzes errors from the last 24 hours
   - Categorizes error types
   - Identifies error patterns and trends

4. **Expired Content Monitoring**
   - Detects content requiring cleanup
   - Tracks expiration backlog
   - Monitors cleanup function effectiveness

5. **External API Health**
   - Tests OpenAI API connectivity
   - Verifies ElevenLabs API status
   - Checks News API availability
   - Monitors Weather API functionality

6. **User Activity Tracking**
   - Monitors new user registrations
   - Tracks active user patterns
   - Analyzes user engagement metrics

### Email Reporting

- **Beautiful HTML Reports**: Professional, responsive email templates
- **Status-Based Alerts**: Different colors and icons for healthy/warning/critical states
- **Detailed Metrics**: Comprehensive system metrics and recommendations
- **Actionable Insights**: Specific recommendations for addressing issues

## API Endpoint

```
POST /functions/v1/health-check
```

### Request
```json
{}
```
No request body required - function runs all health checks automatically.

### Response
```json
{
  "success": true,
  "health_report": {
    "overall_status": "healthy",
    "checks": [...],
    "summary": {
      "total_checks": 6,
      "healthy_count": 5,
      "warning_count": 1,
      "critical_count": 0
    },
    "recommendations": [...],
    "timestamp": "2024-01-15T10:30:00.000Z"
  },
  "email_sent": true,
  "email_error": null,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Environment Variables

### Required
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### Optional (for email notifications)
- `RESEND_API_KEY`: Resend.com API key for email notifications
- `HEALTH_CHECK_EMAIL_TO`: Recipient email address (default: admin@daystart.app)
- `HEALTH_CHECK_EMAIL_FROM`: Sender email address (default: onboarding@resend.dev)

### External API Keys (for API health checks)
- `OPENAI_API_KEY`: OpenAI API key
- `ELEVEN_LABS_API_KEY`: ElevenLabs API key
- `NEWS_API_KEY`: News API key

## Health Check Status Levels

### Healthy ✅
- All systems operating normally
- No immediate action required
- Green status in email reports

### Warning ⚠️
- Some systems showing degraded performance
- Monitor closely but no immediate action required
- Yellow status in email reports

### Critical 🚨
- System issues requiring immediate attention
- Immediate action required
- Red status in email reports

## Thresholds and Alerts

### Content Pipeline
- **Warning**: >100 stuck content blocks or >10% failure rate
- **Critical**: >20% failure rate

### Recent Errors
- **Warning**: >10 errors in last 24 hours
- **Critical**: >50 errors in last 24 hours

### Expired Content
- **Warning**: >20 items requiring cleanup
- **Critical**: >100 items requiring cleanup

### External APIs
- **Warning**: Some APIs failing
- **Critical**: All APIs failing

## Email Report Features

### Visual Design
- Responsive HTML layout
- Color-coded status indicators
- Professional typography
- Mobile-friendly design

### Content Sections
1. **Header**: Overall status and timestamp
2. **Summary**: Quick overview with metrics
3. **Detailed Results**: Individual check results with metrics
4. **Recommendations**: Actionable next steps
5. **Footer**: System information

### Metrics Display
- Status distribution charts
- Error type breakdowns
- Performance metrics
- Trend indicators

## Setup Instructions

### 1. Deploy the Function
```bash
supabase functions deploy health-check
```

### 2. Configure Environment Variables
Set the required environment variables in your Supabase dashboard:
- Go to Settings > API
- Add environment variables under "Environment Variables"

### 3. Set Up Email (Optional)
1. Sign up for Resend.com
2. Create an API key (no domain verification required)
3. Add `RESEND_API_KEY` to environment variables
4. Optionally set `HEALTH_CHECK_EMAIL_TO` to your email address

### 4. Configure Cron Job
Add to your crontab or use Supabase scheduled functions:
```bash
# Daily at 9 AM UTC
0 9 * * * curl -X POST https://your-project.supabase.co/functions/v1/health-check \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring and Maintenance

### Log Analysis
Health check results are logged to the `logs` table with:
- `event_type`: 'health_check_completed'
- `status`: Based on overall health status
- `metadata`: Detailed metrics and results

### Performance Considerations
- Function timeout: 30 seconds
- Database queries optimized for performance
- External API checks with 5-second timeouts
- Batch processing for large datasets

### Troubleshooting

#### Email Not Sending
1. Verify `RESEND_API_KEY` is set correctly
2. Check email addresses are valid
3. Verify domain is verified in Resend
4. Check function logs for error details

#### Health Checks Failing
1. Verify Supabase credentials
2. Check external API keys
3. Review function logs
4. Test individual health checks

#### High Error Rates
1. Review recent error logs
2. Check external API status
3. Verify database connectivity
4. Monitor system resources

## Integration with Other Functions

The health check function works alongside other DayStart functions:

- **Content Generation Functions**: Monitors their success rates
- **Expiration Cleanup**: Tracks cleanup effectiveness
- **Audio Generation**: Monitors audio pipeline health
- **Script Generation**: Tracks script generation success

## Security Considerations

- Uses service role for full database access
- Validates all environment variables
- Implements proper error handling
- Logs all operations for audit purposes
- Uses verified domains for email sending

## Cost Considerations

- **Resend.com**: Free tier covers 3,000 emails/month
- **Supabase Functions**: Included in your current plan
- **Database Queries**: Minimal impact (read-only operations)
- **External API Calls**: Minimal (health check only)

## Future Enhancements

Potential improvements for future versions:
- Historical trend analysis
- Custom alert thresholds
- Webhook notifications
- Dashboard integration
- Auto-remediation suggestions
- Performance benchmarking 