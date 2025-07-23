-- Add 'banana' content type to allowed content types
-- This migration adds support for the new banana content generation function

-- Drop the existing constraint
ALTER TABLE public.content_blocks DROP CONSTRAINT content_blocks_content_type_check;

-- Recreate the constraint with 'banana' added
ALTER TABLE public.content_blocks ADD CONSTRAINT content_blocks_content_type_check CHECK (
    content_type IN (
        'wake_up', 'stretch', 'challenge', 'weather', 'encouragement',
        'headlines', 'sports', 'markets', 'user_intro', 'user_outro', 'user_reminders', 'banana'
    )
);

-- Add comment for documentation
COMMENT ON COLUMN public.content_blocks.content_type IS 'Type of content (wake_up, stretch, challenge, weather, encouragement, headlines, sports, markets, user_intro, user_outro, user_reminders, banana)'; 