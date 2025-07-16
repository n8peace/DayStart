# Cleanup Stuck Content Function

This Supabase Edge Function automatically cleans up content blocks that have been stuck in processing states for too long, preventing infinite stuck states and maintaining system health.

## Overview

The `cleanup-stuck-content` function monitors content blocks that are stuck in processing states and marks them as failed after a configurable timeout period. This ensures the content generation pipeline remains healthy and prevents blocks from getting permanently stuck.

## What Gets Cleaned Up

### Stuck Statuses Monitored
- **`script_generating`** → `script_failed` (GPT-4o script generation)
- **`audio_generating`** → `audio_failed` (ElevenLabs audio generation)
- **`content_generating`** → `content_failed` (Content generation)
- **`retry_pending`** → `failed` (Retry pending)

### Timeout Configuration
- **Default timeout**: 1 hour
- **Configurable**: `STUCK_TIMEOUT_HOURS` constant
- **Batch processing**: Up to 50 blocks per run

## API Endpoint

```
POST /functions/v1/cleanup-stuck-content
```

### Response Format

```json
{
  "success": true,
  "stuck_blocks_found": 5,
  "blocks_cleaned": 5,
  "error_count": 0,
  "errors": [],
  "status_breakdown": {
    "script_generating": 3,
    "audio_generating": 2
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Environment Variables

Required environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

## Configuration

### Timeout Settings
```typescript
const STUCK_TIMEOUT_HOURS = 1 // 1 hour timeout
const BATCH_SIZE = 50 // Process in batches to avoid timeouts
```

### Status Mapping
- Stuck blocks are moved to appropriate failure states
- Retry counts are reset to 0 (since we're giving up)
- Original timestamps are preserved in logs

## Logging

The function provides comprehensive logging for monitoring and debugging:

### Event Types
- `cleanup_stuck_content_started` - Function execution started
- `cleanup_stuck_content_no_blocks` - No stuck blocks found
- `cleanup_stuck_content_success` - Individual block cleaned up
- `cleanup_stuck_content_summary` - Overall cleanup summary
- `cleanup_stuck_content_failed` - Cleanup operation failed
- `cleanup_stuck_content_function_failed` - Function execution failed

### Log Metadata
Each log entry includes:
- Content block details (ID, type, date, user)
- Stuck status and failure status
- Duration the block was stuck
- Original timestamps
- Processing statistics

## Usage

### Manual Execution
Call the function manually to perform immediate cleanup:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/cleanup-stuck-content
```

### Scheduled Execution (Recommended)
Set up a cron job to run every 30 minutes for automatic cleanup:

```bash
# Cron job to run every 30 minutes
*/30 * * * * curl -X POST https://your-project.supabase.co/functions/v1/cleanup-stuck-content
```

## Cron Job Setup

### GitHub Actions (Recommended)
Add this to your `.github/workflows/cron-cleanup.yml`:

```yaml
name: Cleanup Stuck Content

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup Stuck Content
        run: |
          curl -X POST ${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-stuck-content \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}"
```

### Supabase Cron Jobs
If using Supabase's built-in cron functionality:

```sql
-- Create cron job for cleanup (runs every 30 minutes)
SELECT cron.schedule(
  'cleanup-stuck-content',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/cleanup-stuck-content',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'
  );
  $$
);
```

## Error Handling

- **Partial failures**: Function continues processing even if some blocks fail to update
- **Batch processing**: Processes blocks in batches to avoid timeouts
- **Optimistic locking**: Uses status-based locking to prevent race conditions
- **Comprehensive logging**: All operations and errors are logged for monitoring

## Monitoring

### Health Check Integration
The function integrates with the health check system to monitor stuck content:

- High stuck block counts trigger warnings
- Cleanup failures are reported as critical issues
- Processing statistics are available for monitoring

### Metrics to Watch
- **Stuck block count**: Should be low (< 10)
- **Cleanup success rate**: Should be high (> 95%)
- **Error frequency**: Should be minimal
- **Processing time**: Should be under 30 seconds

## Dependencies

- Supabase for database operations and logging
- No external API dependencies
- Self-contained cleanup logic

## Security

- Uses service role key for database access
- No user data exposure in logs
- Optimistic locking prevents race conditions
- Batch processing prevents resource exhaustion 