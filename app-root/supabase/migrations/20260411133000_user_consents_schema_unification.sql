-- USER_CONSENTS SCHEMA UNIFICATION MIGRATION
-- Goal: Single source of truth schema with ONLY:
--   - user_id (uuid, primary key)
--   - accepted_terms (boolean)
--   - consented_at (timestamptz)
--
-- Removes: accepted_kvkk, accepted_privacy_policy, id, email, ip, user_agent, created_at

begin;

-- Step 1: Drop dependent objects to allow column removal
-- Drop indexes that depend on columns being removed
drop index if exists user_consents_email_created_at_idx;
drop index if exists user_consents_ip_created_at_idx;
drop index if exists user_consents_user_created_at_idx;

-- Step 2: Remove all columns except the three required ones
-- Using IF EXISTS to handle cases where columns may already be missing

-- Remove accepted_kvkk (to be deleted)
alter table public.user_consents drop column if exists accepted_kvkk;

-- Remove accepted_privacy_policy (to be deleted)
alter table public.user_consents drop column if exists accepted_privacy_policy;

-- Remove email (to be deleted)
alter table public.user_consents drop column if exists email;

-- Remove ip (to be deleted)
alter table public.user_consents drop column if exists ip;

-- Remove user_agent (to be deleted)
alter table public.user_consents drop column if exists user_agent;

-- Remove created_at (to be deleted - consented_at is sufficient)
alter table public.user_consents drop column if exists created_at;

-- Remove id column (user_id will be the primary key)
-- First drop the primary key constraint if it exists on id
alter table public.user_consents drop constraint if exists user_consents_pkey;
alter table public.user_consents drop column if exists id;

-- Step 3: Ensure required columns exist with correct types
-- Add user_id if missing (should exist from before, but make it primary key)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_consents'
      and column_name = 'user_id'
  ) then
    alter table public.user_consents add column user_id uuid not null;
  end if;
end $$;

-- Add accepted_terms if missing
alter table public.user_consents add column if not exists accepted_terms boolean not null default false;

-- Make accepted_terms NOT NULL (enforce at DB level)
alter table public.user_consents alter column accepted_terms set not null;

-- Add consented_at if missing
alter table public.user_consents add column if not exists consented_at timestamptz not null default now();

-- Make consented_at NOT NULL
alter table public.user_consents alter column consented_at set not null;

-- Step 4: Set primary key on user_id (only if no primary key exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_consents'::regclass
      and contype = 'p'
  ) then
    alter table public.user_consents add primary key (user_id);
  end if;
end $$;

-- Step 5: Add foreign key constraint if missing
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_consents'
      and constraint_type = 'FOREIGN KEY'
  ) then
    alter table public.user_consents
    add constraint user_consents_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Step 6: Recreate ONLY the essential index
-- Index for looking up consents by user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_consents_user_id 
ON public.user_consents(user_id);

-- Step 7: RLS policies (ensure service_role only access)
-- Revoke all from public roles
revoke all on table public.user_consents from anon, authenticated, public;

-- Grant only to service_role
grant all on table public.user_consents to service_role;

-- Step 8: Verify final schema structure
-- This will error if the schema doesn't match expectations
do $$
declare
  _count integer;
begin
  -- Check we have exactly 3 columns
  select count(*) into _count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_consents';
  
  if _count != 3 then
    raise exception 'Schema validation failed: expected 3 columns, found %', _count;
  end if;
  
  -- Check we have the right columns
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_consents'
      and column_name = 'user_id'
  ) then
    raise exception 'Schema validation failed: user_id column missing';
  end if;
  
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_consents'
      and column_name = 'accepted_terms'
  ) then
    raise exception 'Schema validation failed: accepted_terms column missing';
  end if;
  
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_consents'
      and column_name = 'consented_at'
  ) then
    raise exception 'Schema validation failed: consented_at column missing';
  end if;
  
  -- Check for any unwanted columns
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_consents'
      and column_name in ('accepted_kvkk', 'accepted_privacy_policy', 'id', 'email', 'ip', 'user_agent', 'created_at')
  ) then
    raise exception 'Schema validation failed: unwanted columns still exist';
  end if;
  
  raise notice 'Schema validation passed: user_consents has correct 3-column structure';
end $$;

commit;
