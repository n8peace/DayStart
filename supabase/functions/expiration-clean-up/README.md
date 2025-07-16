# Expiration Cleanup Function

This Supabase Edge Function automatically cleans up expired audio content by removing audio files from storage and updating the corresponding database records.

## Purpose

The function identifies content blocks that have passed their expiration date and:
1. Deletes the associated audio file from Supabase Storage
2. Updates the database record to clear the `audio_url` and set status to `'expired'`
3. Maintains the database record for audit and historical purposes

## How It Works

### Query Logic
- Finds content blocks where `expiration_date < CURRENT_DATE`
- Only processes records that have an `audio_url` (not null)
- Excludes records already marked as `'expired'`
- Orders by expiration date (oldest first)

### Storage Cleanup
- Extracts the storage path from the audio URL
- Deletes the file from the `audio-files` bucket
- Handles URL parsing errors gracefully

### Database Updates
- Sets `audio_url` to `null`
- Updates `status` to `'expired'`
- Updates `updated_at` timestamp

### Error Handling
- Continues processing even if storage deletion fails
- Logs all operations to the `logs` table
- Returns detailed error information
- Processes in batches to avoid timeouts

## Usage

### Manual Invocation
```bash
curl -X POST https://your-project.supabase.co/functions/v1/expiration-clean-up \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Scheduled Execution
Recommended to run daily via cron job or Supabase scheduled functions.

## Response Format

```json
{
  "success": true,
  "processed_count": 25,
  "deleted_audio_count": 23,
  "errors": [],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Configuration

### Environment Variables
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database and storage access

### Batch Processing
- Default batch size: 50 records
- Configurable via `BATCH_SIZE` constant

## Logging

All operations are logged to the `logs` table with:
- `event_type`: 'expiration_cleanup'
- `status`: 'success', 'error', or 'partial_success'
- `content_block_id`: ID of processed content block
- `metadata`: Additional context (audio deletion status, content type, etc.)

## Safety Features

- **Idempotent**: Safe to run multiple times
- **Non-destructive**: Database records are preserved, only audio files are deleted
- **Graceful degradation**: Continues processing even if individual operations fail
- **Comprehensive logging**: All operations are tracked for audit purposes
- **Batch processing**: Prevents timeouts on large datasets

## Monitoring

Monitor the function via:
- Supabase Edge Function logs
- `logs` table entries with `event_type = 'expiration_cleanup'`
- Response status codes and error arrays 