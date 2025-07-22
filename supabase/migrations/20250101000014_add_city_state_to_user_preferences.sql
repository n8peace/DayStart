-- Add city and state columns to user_preferences table
-- These fields will be used for more precise location-based content

ALTER TABLE public.user_preferences 
ADD COLUMN city VARCHAR(100),
ADD COLUMN state VARCHAR(2);

-- Add constraints for the new columns
ALTER TABLE public.user_preferences 
ADD CONSTRAINT user_preferences_city_check CHECK (city IS NULL OR length(trim(city)) > 0),
ADD CONSTRAINT user_preferences_state_check CHECK (state IS NULL OR length(trim(state)) = 2);

-- Create indexes for the new columns
CREATE INDEX idx_user_preferences_city ON public.user_preferences(city);
CREATE INDEX idx_user_preferences_state ON public.user_preferences(state);

-- Add comments for documentation
COMMENT ON COLUMN public.user_preferences.city IS 'User city for location-based content matching';
COMMENT ON COLUMN public.user_preferences.state IS 'User state (2-letter code) for location-based content matching'; 