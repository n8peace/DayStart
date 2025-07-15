-- Create content_blocks table for DayStart application
-- This table stores all content (shared and user-specific) in a unified structure

CREATE TABLE public.content_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    script TEXT,
    audio_url VARCHAR(500),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    voice VARCHAR(100),
    duration_seconds INTEGER CHECK (duration_seconds >= 0),
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    content_priority INTEGER DEFAULT 0 CHECK (content_priority >= 0),
    expiration_date DATE NOT NULL,
    language_code VARCHAR(10) DEFAULT 'en-US',
    parameters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    script_generated_at TIMESTAMP WITH TIME ZONE,
    audio_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Add constraints for content types and status values
    CONSTRAINT content_blocks_content_type_check CHECK (
        content_type IN (
            'wake_up', 'stretch', 'challenge', 'weather', 'encouragement',
            'headlines', 'sports', 'markets', 'user_intro', 'user_outro', 'user_reminders'
        )
    ),
    CONSTRAINT content_blocks_status_check CHECK (
        status IN (
            'pending', 'script_generating', 'script_generated', 'audio_generating',
            'ready', 'script_failed', 'audio_failed', 'failed', 'expired', 'retry_pending'
        )
    ),
    CONSTRAINT content_blocks_date_check CHECK (date >= CURRENT_DATE),
    CONSTRAINT content_blocks_expiration_date_check CHECK (expiration_date >= date),
    CONSTRAINT content_blocks_script_timing_check CHECK (
        script_generated_at IS NULL OR script_generated_at >= created_at
    ),
    CONSTRAINT content_blocks_audio_timing_check CHECK (
        audio_generated_at IS NULL OR audio_generated_at >= script_generated_at
    )
);

-- Create indexes for performance
CREATE INDEX idx_content_blocks_content_type_date ON public.content_blocks(content_type, date);
CREATE INDEX idx_content_blocks_user_content_type_date ON public.content_blocks(user_id, content_type, date);
CREATE INDEX idx_content_blocks_status ON public.content_blocks(status);
CREATE INDEX idx_content_blocks_created_at ON public.content_blocks(created_at);
CREATE INDEX idx_content_blocks_expiration_date ON public.content_blocks(expiration_date);
CREATE INDEX idx_content_blocks_content_priority ON public.content_blocks(content_priority);
CREATE INDEX idx_content_blocks_language_code ON public.content_blocks(language_code);
CREATE INDEX idx_content_blocks_parameters ON public.content_blocks USING GIN (parameters);

-- Enable Row Level Security (RLS)
ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can read shared content (user_id IS NULL)
CREATE POLICY "Users can read shared content" ON public.content_blocks
    FOR SELECT USING (user_id IS NULL);

-- Users can read their own user-specific content
CREATE POLICY "Users can read their own content" ON public.content_blocks
    FOR SELECT USING (user_id = auth.uid());

-- Users can write their own user-specific content
CREATE POLICY "Users can write their own content" ON public.content_blocks
    FOR ALL USING (user_id = auth.uid());

-- Service role has full access for background jobs
CREATE POLICY "Service role has full access" ON public.content_blocks
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_content_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_content_blocks_updated_at
    BEFORE UPDATE ON public.content_blocks
    FOR EACH ROW EXECUTE FUNCTION public.update_content_blocks_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.content_blocks TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.content_blocks IS 'Unified content storage for all content types (shared and user-specific)';
COMMENT ON COLUMN public.content_blocks.id IS 'Unique content block identifier';
COMMENT ON COLUMN public.content_blocks.user_id IS 'User ID for user-specific content (NULL for shared content)';
COMMENT ON COLUMN public.content_blocks.date IS 'Date this content is for (morning of...)';
COMMENT ON COLUMN public.content_blocks.content_type IS 'Type of content (wake_up, stretch, challenge, etc.)';
COMMENT ON COLUMN public.content_blocks.script IS 'GPT-4o generated text content';
COMMENT ON COLUMN public.content_blocks.audio_url IS 'ElevenLabs generated audio file location';
COMMENT ON COLUMN public.content_blocks.status IS 'Current state in the generation pipeline';
COMMENT ON COLUMN public.content_blocks.voice IS 'ElevenLabs voice identifier used';
COMMENT ON COLUMN public.content_blocks.duration_seconds IS 'Duration of the generated audio in seconds';
COMMENT ON COLUMN public.content_blocks.retry_count IS 'Number of retry attempts for failed operations';
COMMENT ON COLUMN public.content_blocks.content_priority IS 'Priority for content assembly order (lower = higher priority)';
COMMENT ON COLUMN public.content_blocks.expiration_date IS 'When this content expires and should be regenerated';
COMMENT ON COLUMN public.content_blocks.language_code IS 'Language code for content';
COMMENT ON COLUMN public.content_blocks.parameters IS 'Content-specific parameters (zipcode, sport, philosophy, etc.)';
COMMENT ON COLUMN public.content_blocks.created_at IS 'When the record was first created';
COMMENT ON COLUMN public.content_blocks.updated_at IS 'Last modification to the record';
COMMENT ON COLUMN public.content_blocks.script_generated_at IS 'When GPT-4o finished generating the script';
COMMENT ON COLUMN public.content_blocks.audio_generated_at IS 'When ElevenLabs finished creating the audio'; 