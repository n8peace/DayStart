-- Add audio_duration column to content_blocks table
-- This column stores the duration of the generated audio in seconds
-- This is separate from duration_seconds for backward compatibility

ALTER TABLE public.content_blocks 
ADD COLUMN audio_duration INTEGER CHECK (audio_duration >= 0);

-- Add comment for documentation
COMMENT ON COLUMN public.content_blocks.audio_duration IS 'Duration of the generated audio in seconds (alternative to duration_seconds)';

-- Create index for performance
CREATE INDEX idx_content_blocks_audio_duration ON public.content_blocks(audio_duration); 