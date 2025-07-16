-- Add content column to content_blocks table
-- This separates the raw content from the script and audio generation

ALTER TABLE public.content_blocks 
ADD COLUMN content TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.content_blocks.content IS 'Raw content text before script generation'; 