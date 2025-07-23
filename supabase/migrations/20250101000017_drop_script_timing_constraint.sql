-- Drop the script timing constraint that's causing issues
-- This constraint was overly restrictive and not providing business value

-- Drop the existing constraint
ALTER TABLE public.content_blocks DROP CONSTRAINT content_blocks_script_timing_check;

-- Add comment for documentation
COMMENT ON COLUMN public.content_blocks.script_generated_at IS 'When GPT-4o finished generating the script (no longer constrained to be after created_at)'; 