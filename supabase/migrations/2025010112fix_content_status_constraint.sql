-- Fix content_blocks status constraint to include all valid statuses
-- This migration ensures the database constraint matches the actual status values used in the codebase

-- Drop the existing constraint
ALTER TABLE public.content_blocks DROP CONSTRAINT IF EXISTS content_blocks_status_check;

-- Recreate the constraint with all valid status values
ALTER TABLE public.content_blocks ADD CONSTRAINT content_blocks_status_check CHECK (
    status IN (
        pending',
    content_generating',
        content_ready', 
        content_failed,
        script_generating,
       script_generated,
       script_failed',
       audio_generating',
        ready',
      audio_failed,       failed',
        expired',
      retry_pending
    ));

-- Add comment explaining the status values
COMMENT ON COLUMN public.content_blocks.status ISCurrent state in the generation pipeline. Valid values: pending, content_generating, content_ready, content_failed, script_generating, script_generated, script_failed, audio_generating, ready, audio_failed, failed, expired, retry_pending';

-- Verify the constraint was applied correctly
DO $$
BEGIN
    -- Check if the constraint exists
    IF NOT EXISTS (
        SELECT 1FROM information_schema.table_constraints 
        WHERE constraint_name = 'content_blocks_status_check' 
        AND table_name =content_blocks'
    ) THEN
        RAISE EXCEPTION Status constraint was not applied correctly';
    END IF;
    
    RAISE NOTICE 'Content blocks status constraint updated successfully';
END $$; 