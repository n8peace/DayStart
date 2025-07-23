-- Add name column to user_preferences table
-- This field will store the user's display name for personalization

ALTER TABLE public.user_preferences 
ADD COLUMN name VARCHAR(100);

-- Add constraint for the new column
ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_name_check CHECK (name IS NULL OR length(trim(name)) > 0);

-- Create index for the new column
CREATE INDEX idx_user_preferences_name ON public.user_preferences(name);

-- Add comment for documentation
COMMENT ON COLUMN public.user_preferences.name IS 'User display name for personalization'; 