-- Create user_preferences table for DayStart application
-- This table stores minimal user settings that are critical for backend operations

CREATE TABLE public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    timezone VARCHAR(50) NOT NULL,
    location_zip VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT user_preferences_timezone_check CHECK (timezone IS NOT NULL),
    CONSTRAINT user_preferences_location_zip_check CHECK (location_zip IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX idx_user_preferences_location_zip ON public.user_preferences(location_zip);
CREATE INDEX idx_user_preferences_timezone ON public.user_preferences(timezone);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can manage their own preferences
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL USING (user_id = auth.uid());

-- Service role has full access for background jobs
CREATE POLICY "Service role has full access" ON public.user_preferences
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.user_preferences TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.user_preferences IS 'Minimal user settings critical for backend operations';
COMMENT ON COLUMN public.user_preferences.user_id IS 'Primary key, references users table';
COMMENT ON COLUMN public.user_preferences.timezone IS 'User timezone for scheduling and timing';
COMMENT ON COLUMN public.user_preferences.location_zip IS 'User zipcode for location-based content matching';
COMMENT ON COLUMN public.user_preferences.created_at IS 'When the record was created';
COMMENT ON COLUMN public.user_preferences.updated_at IS 'Last modification to the record'; 