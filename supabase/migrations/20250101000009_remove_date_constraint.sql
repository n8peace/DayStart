-- Remove the date constraint that prevents content blocks from having past dates
-- This constraint was incorrectly preventing script generation for content blocks with past dates

-- Drop the existing constraint
ALTER TABLE public.content_blocks DROP CONSTRAINT IF EXISTS content_blocks_date_check;

-- Add comment explaining the change
COMMENT ON COLUMN public.content_blocks.date IS 'Date this content is for (morning of...) - can be past, present, or future'; 