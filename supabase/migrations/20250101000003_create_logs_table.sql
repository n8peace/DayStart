-- Create logs table for DayStart application
-- This table provides system-wide logging for debugging, monitoring, analytics, and audit trails

CREATE TABLE public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content_block_id UUID REFERENCES public.content_blocks(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Add constraints
    CONSTRAINT logs_event_type_check CHECK (event_type IS NOT NULL),
    CONSTRAINT logs_status_check CHECK (
        status IN ('success', 'error', 'warning', 'info')
    )
);

-- Create indexes for performance
CREATE INDEX idx_logs_event_type ON public.logs(event_type);
CREATE INDEX idx_logs_created_at ON public.logs(created_at);
CREATE INDEX idx_logs_user_id ON public.logs(user_id);
CREATE INDEX idx_logs_status ON public.logs(status);
CREATE INDEX idx_logs_content_block_id ON public.logs(content_block_id);
CREATE INDEX idx_logs_user_created_at ON public.logs(user_id, created_at);
CREATE INDEX idx_logs_event_type_status ON public.logs(event_type, status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can read their own logs
CREATE POLICY "Users can read their own logs" ON public.logs
    FOR SELECT USING (user_id = auth.uid());

-- Service role has full access for system monitoring
CREATE POLICY "Service role has full access" ON public.logs
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON public.logs TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.logs IS 'System-wide logging for debugging, monitoring, analytics, and audit trails';
COMMENT ON COLUMN public.logs.id IS 'Unique log entry identifier';
COMMENT ON COLUMN public.logs.event_type IS 'Type of event (content_generated, alarm_triggered, etc.)';
COMMENT ON COLUMN public.logs.user_id IS 'User who triggered the event (nullable for system events)';
COMMENT ON COLUMN public.logs.content_block_id IS 'Related content block ID (nullable for general events)';
COMMENT ON COLUMN public.logs.status IS 'Event status (success, error, warning, info)';
COMMENT ON COLUMN public.logs.message IS 'Detailed event description or error message';
COMMENT ON COLUMN public.logs.metadata IS 'Additional event data (API responses, timing info, etc.)';
COMMENT ON COLUMN public.logs.ip_address IS 'IP address of the request (nullable for background jobs)';
COMMENT ON COLUMN public.logs.user_agent IS 'User agent string (nullable for background jobs)';
COMMENT ON COLUMN public.logs.created_at IS 'When the event occurred'; 