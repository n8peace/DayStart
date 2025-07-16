-- Add voice column to user_preferences table
-- This column stores the user's preferred ElevenLabs voice identifier

ALTER TABLE public.user_preferences 
ADD COLUMN voice VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.voice IS 'ElevenLabs voice identifier for user preference'; 