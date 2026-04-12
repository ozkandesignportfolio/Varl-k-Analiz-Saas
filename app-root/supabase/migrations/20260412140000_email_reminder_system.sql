-- Email Reminder System for Unverified Users
-- Migration: 20260412140000

-- 1. Create email_reminder_logs table for tracking reminder attempts
CREATE TABLE IF NOT EXISTS public.email_reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    reminder_type VARCHAR(50) NOT NULL DEFAULT 'verification_reminder',
    status VARCHAR(20) NOT NULL CHECK (status IN ('attempt', 'success', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_reminder_logs_user_id ON public.email_reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_reminder_logs_sent_at ON public.email_reminder_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_reminder_logs_status ON public.email_reminder_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_reminder_logs_user_sent_at ON public.email_reminder_logs(user_id, sent_at);

-- Enable RLS
ALTER TABLE public.email_reminder_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can access logs
CREATE POLICY "Service role full access on email_reminder_logs"
    ON public.email_reminder_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- No access for authenticated users (they can only see their own data via specific RPC if needed)
CREATE POLICY "No user access on email_reminder_logs"
    ON public.email_reminder_logs
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 2. Create function to find unverified users needing reminders
-- Rate limit: 1 reminder per user per 24 hours
CREATE OR REPLACE FUNCTION public.find_unverified_users_for_reminder(
    p_min_age_interval INTERVAL DEFAULT INTERVAL '10 minutes',
    p_reminder_cooldown INTERVAL DEFAULT INTERVAL '24 hours',
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    user_id UUID,
    email VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id::UUID as user_id,
        u.email::VARCHAR as email,
        u.created_at
    FROM auth.users u
    WHERE u.email_confirmed_at IS NULL
        AND u.created_at < NOW() - p_min_age_interval
        AND NOT EXISTS (
            -- Check if reminder was sent within cooldown period
            SELECT 1 
            FROM public.email_reminder_logs erl 
            WHERE erl.user_id = u.id 
                AND erl.reminder_type = 'verification_reminder'
                AND erl.status IN ('attempt', 'success')
                AND erl.sent_at > NOW() - p_reminder_cooldown
        )
    ORDER BY u.created_at ASC
    LIMIT p_limit;
END;
$$;

-- 3. Create function to log reminder attempt
CREATE OR REPLACE FUNCTION public.log_email_reminder(
    p_user_id UUID,
    p_email VARCHAR,
    p_reminder_type VARCHAR DEFAULT 'verification_reminder',
    p_status VARCHAR,
    p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.email_reminder_logs (
        user_id,
        email,
        reminder_type,
        status,
        error_message,
        sent_at
    ) VALUES (
        p_user_id,
        p_email,
        p_reminder_type,
        p_status,
        p_error_message,
        NOW()
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- 4. Create function to get reminder statistics (for monitoring)
CREATE OR REPLACE FUNCTION public.get_email_reminder_stats(
    p_since TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS TABLE (
    total_attempts BIGINT,
    total_success BIGINT,
    total_failed BIGINT,
    unique_users BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        COUNT(*)::BIGINT as total_attempts,
        COUNT(*) FILTER (WHERE status = 'success')::BIGINT as total_success,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as total_failed,
        COUNT(DISTINCT user_id)::BIGINT as unique_users
    FROM public.email_reminder_logs
    WHERE sent_at >= p_since;
$$;

-- 5. Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.find_unverified_users_for_reminder TO service_role;
GRANT EXECUTE ON FUNCTION public.log_email_reminder TO service_role;
GRANT EXECUTE ON FUNCTION public.get_email_reminder_stats TO service_role;

-- 6. Add comment for documentation
COMMENT ON TABLE public.email_reminder_logs IS 
    'Tracks all email reminder attempts for unverified users. Rate limited to 1 reminder per 24 hours per user.';
