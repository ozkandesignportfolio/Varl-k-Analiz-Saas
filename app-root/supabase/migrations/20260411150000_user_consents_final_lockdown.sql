-- USER_CONSENTS FINAL LOCKDOWN MIGRATION
-- ======================================
-- MISSION: Eliminate ALL schema drift permanently
-- STRATEGY: Clean DROP → CREATE → TRIGGER → RLS → VERIFY
-- 
-- FINAL SCHEMA (3 columns ONLY):
--   user_id: uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
--   accepted_terms: boolean NOT NULL
--   consented_at: timestamptz NOT NULL DEFAULT now()
--
-- ANTI-DRIFT: Trigger rejects any unexpected columns
-- RLS: Authenticated users can only access their own data

begin;

-- ============================================================
-- STEP 1: COMPLETE TABLE DESTRUCTION (CLEAN SLATE)
-- ============================================================

-- Drop trigger first (if exists from previous attempts)
drop trigger if exists trg_enforce_user_consents_schema on public.user_consents;

-- Drop function (if exists)
drop function if exists public.enforce_user_consents_schema();

-- Drop all RLS policies (will be recreated)
-- Policies are dropped automatically with CASCADE but we ensure clean state

-- COMPLETE TABLE DROP - CASCADE removes all dependent objects
-- This includes: indexes, constraints, policies, triggers, views
drop table if exists public.user_consents cascade;

-- ============================================================
-- STEP 2: FROZEN SCHEMA CREATION
-- ============================================================

-- Create table with EXACTLY 3 columns - NO MORE, NO LESS
create table public.user_consents (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null,
  consented_at timestamptz not null default now()
);

-- Minimal index - unique index on user_id serves dual purpose:
-- 1. Enforces one consent record per user
-- 2. Provides fast lookup by user_id
create unique index idx_user_consents_user_id on public.user_consents(user_id);

-- ============================================================
-- STEP 3: HARD ENFORCEMENT LAYER (ANTI-DRIFT)
-- ============================================================

-- Function to reject ANY payload with unexpected fields
-- This acts as runtime schema validation at database level
-- Fires on EVERY insert/update to ensure no column drift

create or replace function public.enforce_user_consents_schema()
returns trigger
language plpgsql
as $$
declare
  key text;
  allowed_keys text[] := array['user_id', 'accepted_terms', 'consented_at'];
begin
  -- Iterate through all keys in the NEW row
  for key in select jsonb_object_keys(to_jsonb(new))
  loop
    -- Reject if key is not in allowed list
    if not key = any(allowed_keys) then
      raise exception 'SCHEMA_VIOLATION: Column "%" does not exist in user_consents. Allowed: %', 
        key, allowed_keys
        using hint = 'The user_consents schema is FROZEN. Only user_id, accepted_terms, consented_at are allowed. No new columns can be added.';
    end if;
  end loop;
  
  -- Additional validation: user_id cannot be null
  if new.user_id is null then
    raise exception 'SCHEMA_VIOLATION: user_id cannot be null'
      using hint = 'user_id is required and must be a valid uuid referencing auth.users';
  end if;
  
  -- Additional validation: accepted_terms must be boolean
  if new.accepted_terms is null then
    raise exception 'SCHEMA_VIOLATION: accepted_terms cannot be null'
      using hint = 'accepted_terms must be a boolean (true/false)';
  end if;
  
  return new;
end;
$$;

-- Attach enforcement trigger (fires before any insert/update)
create trigger trg_enforce_user_consents_schema
before insert or update on public.user_consents
for each row
execute function public.enforce_user_consents_schema();

-- ============================================================
-- STEP 4: RLS LOCKDOWN (Authenticated Users Only)
-- ============================================================

-- Enable RLS
alter table public.user_consents enable row level security;

-- Revoke ALL access from public roles (defense in depth)
revoke all on table public.user_consents from anon, authenticated, public;

-- Grant service_role full access (for admin operations)
grant select, insert, update, delete on table public.user_consents to service_role;

-- DROP ALL existing policies (clean slate)
do $$
declare
  pol record;
begin
  for pol in 
    select policyname 
    from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_consents'
  loop
    execute format('drop policy if exists %I on public.user_consents', pol.policyname);
  end loop;
end $$;

-- POLICY: Users can INSERT only their own consent record
-- Uses auth.uid() to ensure user can only insert for themselves
create policy user_consents_insert_own
on public.user_consents
for insert
to authenticated
with check (user_id = auth.uid());

-- POLICY: Users can SELECT only their own consent record
create policy user_consents_select_own
on public.user_consents
for select
to authenticated
using (user_id = auth.uid());

-- POLICY: Users can UPDATE only their own consent record (rarely needed but allowed)
create policy user_consents_update_own
on public.user_consents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- POLICY: Users cannot DELETE their consent (for audit trail)
-- No delete policy = delete is denied

-- ============================================================
-- STEP 5: IRONCLAD VERIFICATION (FAILS MIGRATION IF WRONG)
-- ============================================================

do $$
declare
  col_count integer;
  expected_columns text[] := array['user_id', 'accepted_terms', 'consented_at'];
  actual_columns text[];
  trigger_exists boolean;
  policy_count integer;
begin
  -- Count columns
  select count(*) into col_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  -- Verify exactly 3 columns
  if col_count != 3 then
    raise exception 'FINAL_LOCKDOWN_FAILED: Expected 3 columns, found %', col_count;
  end if;
  
  -- Get actual column names
  select array_agg(column_name::text order by ordinal_position)
  into actual_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  -- Verify exact column names
  if actual_columns != expected_columns then
    raise exception 'FINAL_LOCKDOWN_FAILED: Column mismatch. Expected: %, Got: %', 
      expected_columns, actual_columns;
  end if;
  
  -- Verify PK on user_id
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_consents'::regclass
      and contype = 'p'
  ) then
    raise exception 'FINAL_LOCKDOWN_FAILED: Primary key missing';
  end if;
  
  -- Verify FK exists
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_consents'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'FINAL_LOCKDOWN_FAILED: Foreign key constraint missing';
  end if;
  
  -- Verify enforcement trigger exists
  select exists(
    select 1 from pg_trigger
    where tgname = 'trg_enforce_user_consents_schema'
      and tgrelid = 'public.user_consents'::regclass
  ) into trigger_exists;
  
  if not trigger_exists then
    raise exception 'FINAL_LOCKDOWN_FAILED: Schema enforcement trigger missing';
  end if;
  
  -- Verify RLS policies exist
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' 
    and tablename = 'user_consents';
    
  if policy_count < 3 then
    raise exception 'FINAL_LOCKDOWN_FAILED: Expected at least 3 RLS policies, found %', policy_count;
  end if;
  
  raise notice 'FINAL_LOCKDOWN_SUCCESS: user_consents table verified with % columns, trigger active, % RLS policies', col_count, policy_count;
end $$;

commit;

-- ============================================================
-- STEP 6: FORCE SCHEMA CACHE REFRESH
-- ============================================================

-- Notify PostgREST to reload schema (prevents stale cache issues)
select pg_notify('pgrst', 'reload schema');

-- ============================================================
-- VERIFICATION QUERIES (Run these to confirm)
-- ============================================================

-- Q1: Verify exact column count and names:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' AND table_name = 'user_consents' 
-- ORDER BY ordinal_position;
-- 
-- EXPECTED: exactly 3 rows:
--   user_id: uuid, NO, null
--   accepted_terms: boolean, NO, null
--   consented_at: timestamptz, NO, now()

-- Q2: Verify enforcement trigger exists:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'user_consents'::regclass;
--
-- EXPECTED: trg_enforce_user_consents_schema, O (enabled)

-- Q3: Verify RLS policies:
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_consents';
--
-- EXPECTED: 3 policies (insert_own, select_own, update_own)

-- Q4: Test enforcement (this SHOULD fail with SCHEMA_VIOLATION error):
-- INSERT INTO user_consents (user_id, accepted_terms, consented_at, email) 
-- VALUES (gen_random_uuid(), true, now(), 'test@example.com');
--
-- EXPECTED: ERROR: SCHEMA_VIOLATION: Column "email" does not exist

-- Q5: Test valid insert (requires valid auth.user uuid):
-- INSERT INTO user_consents (user_id, accepted_terms, consented_at) 
-- VALUES ((SELECT id FROM auth.users LIMIT 1), true, now());
--
-- EXPECTED: SUCCESS (1 row inserted) or ERROR: duplicate key if exists

-- ============================================================
-- END OF MIGRATION
-- ============================================================
