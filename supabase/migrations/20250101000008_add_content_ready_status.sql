-- Add 'content_ready' and 'content_failed' status to content_blocks table
-- This allows content generation functions to mark content as ready or failed after generation

-- Drop the existing constraint
ALTER TABLE public.content_blocks DROP CONSTRAINT IF EXISTS content_blocks_status_check;

-- Recreate the constraint with 'content_ready' and 'content_failed' added
ALTER TABLE public.content_blocks ADD CONSTRAINT content_blocks_status_check CHECK (
    status IN (
        'pending', 'script_generating', 'script_generated', 'audio_generating',
        'ready', 'content_ready', 'content_failed', 'script_failed', 'audio_failed', 'failed', 'expired', 'retry_pending'
    )
);

-- Add comment explaining the new statuses
COMMENT ON COLUMN public.content_blocks.status IS 'Current state in the generation pipeline (content_ready = content generated successfully, content_failed = content generation failed)'; 