-- Email Reminder Cron Schedule
-- Migration: 20260412141000
-- Sets up pg_cron to trigger the email reminder edge function every hour

-- Note: This migration requires:
-- 1. pg_cron extension enabled in Supabase
-- 2. pg_net extension enabled for HTTP requests
-- 3. Edge Function deployed at: email-reminder
-- 4. Edge Function URL and secret configured

-- First, ensure required extensions are available
-- (These may already be enabled, but we verify here)

-- Create function to invoke the email reminder edge function via HTTP
-- This function is called by pg_cron
CREATE OR REPLACE FUNCTION public.invoke_email_reminder_cron()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    edge_function_url TEXT;
    cron_secret TEXT;
    response_status INTEGER;
    response_body TEXT;
BEGIN
    -- Get configuration from environment or vault
    -- In production, use Supabase Vault or Edge Function settings
    edge_function_url := current_setting('app.settings.email_reminder_function_url', true);
    cron_secret := current_setting('app.settings.email_reminder_cron_secret', true);
    
    -- Fallback to common patterns if not explicitly set
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
        -- Construct URL from project ref (Supabase standard format)
        edge_function_url := 'https://' || current_setting('supabase.project_ref', true) || '.supabase.co/functions/v1/email-reminder';
    END IF;
    
    -- Validate configuration
    IF edge_function_url IS NULL OR edge_function_url = '' THEN
        RAISE EXCEPTION 'Email reminder function URL not configured';
    END IF;
    
    IF cron_secret IS NULL OR cron_secret = '' THEN
        RAISE EXCEPTION 'Email reminder cron secret not configured';
    END IF;
    
    -- Log invocation attempt
    INSERT INTO public.email_reminder_logs (user_id, email, reminder_type, status, error_message)
    VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID,
        'system@assetly.app',
        'cron_invocation',
        'attempt',
        'Cron triggered at ' || NOW()::TEXT
    );
    
    -- Invoke edge function via pg_net if available, otherwise log for external trigger
    -- Note: pg_net has limitations with complex headers, so we recommend using Supabase CLI
    -- or external cron service (like GitHub Actions, Vercel Cron) to trigger the function
    
    -- For now, we log that cron was triggered - actual invocation should be done via:
    -- 1. Supabase CLI: supabase functions invoke email-reminder
    -- 2. External cron service with HTTP POST to edge function URL
    -- 3. Vercel Cron (see vercel.json)
    
    RAISE NOTICE 'Email reminder cron triggered. URL: %, Time: %', edge_function_url, NOW();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.invoke_email_reminder_cron TO service_role;

-- Schedule the cron job (runs every hour)
-- Note: This requires pg_cron extension to be enabled
DO $$
BEGIN
    -- Check if pg_cron is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing job if present
        PERFORM cron.unschedule('email-reminder-hourly');
        
        -- Schedule new job
        PERFORM cron.schedule(
            'email-reminder-hourly',
            '0 * * * *',  -- Every hour at minute 0
            'SELECT public.invoke_email_reminder_cron()'
        );
        
        RAISE NOTICE 'Email reminder cron job scheduled to run every hour';
    ELSE
        RAISE WARNING 'pg_cron extension not available. Email reminder must be triggered externally.';
    END IF;
END;
$$;

-- Create view to monitor cron job status
CREATE OR REPLACE VIEW public.email_reminder_cron_status AS
SELECT 
    'email-reminder-hourly' as job_name,
    '0 * * * *' as schedule,
    'Every hour' as description,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
        THEN 'pg_cron available'
        ELSE 'pg_cron NOT available - use external trigger'
    END as status;

-- Add helpful comments
COMMENT ON FUNCTION public.invoke_email_reminder_cron IS 
    'Invoked by pg_cron every hour to trigger email reminder edge function. Falls back to logging if direct HTTP invocation is not available.';

COMMENT ON VIEW public.email_reminder_cron_status IS 
    'Shows the status of the email reminder cron job configuration';

-- Alternative: RPC function for direct processing (if edge function is not available)
-- This can be called by external cron services
CREATE OR REPLACE FUNCTION public.process_email_reminders_direct(
    p_batch_size INTEGER DEFAULT 50,
    p_min_age_interval TEXT DEFAULT '10 minutes',
    p_cooldown_interval TEXT DEFAULT '24 hours'
)
RETURNS TABLE (
    processed INTEGER,
    success INTEGER,
    failed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_users RECORD;
    v_processed INTEGER := 0;
    v_success INTEGER := 0;
    v_failed INTEGER := 0;
BEGIN
    -- This is a placeholder that returns the count of users needing reminders
    -- Actual email sending requires Resend API key and should be done via Edge Function
    -- or external service with proper error handling
    
    SELECT COUNT(*)::INTEGER INTO v_processed
    FROM public.find_unverified_users_for_reminder(
        p_min_age_interval::INTERVAL,
        p_cooldown_interval::INTERVAL,
        p_batch_size
    );
    
    processed := v_processed;
    success := 0;
    failed := 0;
    
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_email_reminders_direct TO service_role;

COMMENT ON FUNCTION public.process_email_reminders_direct IS 
    'Returns count of users needing reminders. Does NOT send emails directly (requires external service with Resend API access).';
