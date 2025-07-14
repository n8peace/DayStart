-- Create users table for DayStart application
-- This table stores user account information and preferences

CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    onboarding_status VARCHAR(50) DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'completed', 'skipped')),
    subscription_status VARCHAR(50) DEFAULT 'free' CHECK (subscription_status IN ('free', 'premium', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Add indexes for common queries
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_subscription_status ON public.users(subscription_status);
CREATE INDEX idx_users_created_at ON public.users(created_at);
CREATE INDEX idx_users_last_login ON public.users(last_login);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Only admins can insert new users (typically handled by auth.users trigger)
CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT id FROM public.users WHERE is_admin = TRUE
    ));

-- Only admins can delete users
CREATE POLICY "Admins can delete users" ON public.users
    FOR DELETE USING (auth.uid() IN (
        SELECT id FROM public.users WHERE is_admin = TRUE
    ));

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, created_at)
    VALUES (NEW.id, NEW.email, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.users IS 'User accounts and profile information for DayStart app';
COMMENT ON COLUMN public.users.id IS 'Unique user identifier';
COMMENT ON COLUMN public.users.email IS 'User email address (unique)';
COMMENT ON COLUMN public.users.phone IS 'User phone number (optional)';
COMMENT ON COLUMN public.users.onboarding_status IS 'User onboarding completion status';
COMMENT ON COLUMN public.users.subscription_status IS 'User subscription level';
COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN public.users.is_admin IS 'Admin privileges flag';
COMMENT ON COLUMN public.users.last_login IS 'Last login timestamp'; 