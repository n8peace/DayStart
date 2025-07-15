-- Create user_weather_data table for DayStart application
-- This table stores Weather Kit data as a shared resource for multiple users

CREATE TABLE public.user_weather_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_key VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    weather_data JSONB NOT NULL DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    fetch_count INTEGER DEFAULT 0 CHECK (fetch_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT user_weather_data_location_key_check CHECK (location_key IS NOT NULL),
    CONSTRAINT user_weather_data_date_check CHECK (date IS NOT NULL),
    CONSTRAINT user_weather_data_expires_at_check CHECK (expires_at > created_at),
    CONSTRAINT user_weather_data_unique_location_date UNIQUE (location_key, date)
);

-- Create indexes for performance
CREATE INDEX idx_user_weather_data_location_date ON public.user_weather_data(location_key, date);
CREATE INDEX idx_user_weather_data_expires_at ON public.user_weather_data(expires_at);
CREATE INDEX idx_user_weather_data_last_updated ON public.user_weather_data(last_updated);
CREATE INDEX idx_user_weather_data_weather_data ON public.user_weather_data USING GIN (weather_data);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_weather_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can read weather data (shared resource)
CREATE POLICY "Users can read weather data" ON public.user_weather_data
    FOR SELECT USING (true);

-- Service role can manage weather data
CREATE POLICY "Service role can manage weather data" ON public.user_weather_data
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_weather_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_weather_data_updated_at
    BEFORE UPDATE ON public.user_weather_data
    FOR EACH ROW EXECUTE FUNCTION public.update_user_weather_data_updated_at();

-- Create function to increment fetch_count
CREATE OR REPLACE FUNCTION public.increment_weather_fetch_count()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fetch_count = OLD.fetch_count + 1;
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment fetch_count on read
CREATE TRIGGER increment_weather_fetch_count
    BEFORE UPDATE ON public.user_weather_data
    FOR EACH ROW EXECUTE FUNCTION public.increment_weather_fetch_count();

-- Grant necessary permissions
GRANT ALL ON public.user_weather_data TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.user_weather_data IS 'Weather Kit data cache shared by users in same location';
COMMENT ON COLUMN public.user_weather_data.id IS 'Unique weather data record identifier';
COMMENT ON COLUMN public.user_weather_data.location_key IS 'Location identifier (zipcode for US, lat_lng for international)';
COMMENT ON COLUMN public.user_weather_data.date IS 'Date this weather data is for';
COMMENT ON COLUMN public.user_weather_data.weather_data IS 'Complete Weather Kit response data in JSONB format';
COMMENT ON COLUMN public.user_weather_data.last_updated IS 'When this data was last fetched or accessed';
COMMENT ON COLUMN public.user_weather_data.expires_at IS 'When this data expires and should be refreshed';
COMMENT ON COLUMN public.user_weather_data.fetch_count IS 'Number of times this data has been accessed';
COMMENT ON COLUMN public.user_weather_data.created_at IS 'When the record was first created';
COMMENT ON COLUMN public.user_weather_data.updated_at IS 'Last modification to the record'; 