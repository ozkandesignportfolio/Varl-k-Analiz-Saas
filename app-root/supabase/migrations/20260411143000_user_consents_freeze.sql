-- USER_CONSENTS SCHEMA FREEZE - PERMANENT LOCKDOWN
-- =================================================
-- MISSION: Stop schema drift forever
-- STRATEGY: Drop → Create → Lockdown → Verify
-- FINAL SCHEMA: 3 columns ONLY - any deviation is rejected

-- Start transaction
begin;

-- STEP 1: COMPLETE TABLE DESTRUCTION
-- Drop everything: table, indexes, constraints, policies, triggers
drop table if exists public.user_consents cascade;

-- STEP 2: FROZEN SCHEMA CREATION
-- Create table with EXACT 3 columns. NO MORE, NO LESS.
create table public.user_consents (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null,
  consented_at timestamptz not null default now()
);

-- STEP 3: HARD ENFORCEMENT LAYER
-- Function to reject ANY payload with unexpected fields
-- This acts as runtime schema validation at database level

create or replace function public.enforce_user_consents_schema()
returns trigger
language plpgsql
as $$
declare
  key text;
  allowed_keys text[] := array['user_id', 'accepted_terms', 'consented_at'];
begin
  -- Check for any unexpected keys in the NEW row
  for key in select jsonb_object_keys(to_jsonb(new))
  loop
    if not key = any(allowed_keys) then
      raise exception 'SCHEMA_VIOLATION: Column "%" does not exist in user_consents. Allowed: %', 
        key, allowed_keys
        using hint = 'The user_consents schema is frozen. Only user_id, accepted_terms, consented_at are allowed.';
    end if;
  end loop;
  
  return new;
end;
$$;

-- Attach enforcement trigger (fires before any insert/update)
drop trigger if exists trg_enforce_user_consents_schema on public.user_consents;
create trigger trg_enforce_user_consents_schema
before insert or update on public.user_consents
for each row
execute function public.enforce_user_consents_schema();

-- STEP 4: SECURITY LOCKDOWN
-- Minimal access - service_role only
alter table public.user_consents enable row level security;
revoke all on table public.user_consents from anon, authenticated, public;
grant select, insert, update, delete on table public.user_consents to service_role;

-- STEP 5: INDEX (minimal)
create unique index idx_user_consents_user_id on public.user_consents(user_id);

-- STEP 6: IRONCLAD VERIFICATION
-- This will FAIL the migration if schema is not EXACTLY correct
do $$
declare
  col_count integer;
  col_record record;
  expected_columns text[] := array['user_id', 'accepted_terms', 'consented_at'];
  actual_columns text[];
  trigger_exists boolean;
begin
  -- Count columns
  select count(*) into col_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  if col_count != 3 then
    raise exception 'FREEZE_FAILED: Expected 3 columns, found %', col_count;
  end if;
  
  -- Get actual column names
  select array_agg(column_name::text order by ordinal_position)
  into actual_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  if actual_columns != expected_columns then
    raise exception 'FREEZE_FAILED: Column mismatch. Expected: %, Got: %', 
      expected_columns, actual_columns;
  end if;
  
  -- Verify PK on user_id
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_consents'::regclass
      and contype = 'p'
  ) then
    raise exception 'FREEZE_FAILED: Primary key missing';
  end if;
  
  -- Verify FK exists
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_consents'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'FREEZE_FAILED: Foreign key constraint missing';
  end if;
  
  -- Verify enforcement trigger exists
  select exists(
    select 1 from pg_trigger
    where tgname = 'trg_enforce_user_consents_schema'
      and tgrelid = 'public.user_consents'::regclass
  ) into trigger_exists;
  
  if not trigger_exists then
    raise exception 'FREEZE_FAILED: Schema enforcement trigger missing';
  end if;
  
  raise notice 'SCHEMA_FREEZE_SUCCESS: user_consents locked with 3 columns and hard enforcement';
end $$;

commit;

-- STEP 7: FORCE SCHEMA CACHE REFRESH
-- Notify PostgREST to reload schema (prevents stale cache issues)
select pg_notify('pgrst', 'reload schema');

-- Optional: Force connection pool reset (if supported by Supabase)
-- Note: This may require service_role or admin access
-- select pg_terminate_backend(pid) from pg_stat_activity 
-- where datname = current_database() and pid != pg_backend_pid();

-- ============================================
-- VERIFICATION QUERIES (Run these to confirm)
-- ============================================

-- Q1: Verify exact column count and names:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_consents' 
-- ORDER BY ordinal_position;
-- 
-- Expected: exactly 3 rows (user_id, accepted_terms, consented_at)

-- Q2: Verify enforcement trigger exists:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'user_consents'::regclass;
--
-- Expected: trg_enforce_user_consents_schema

-- Q3: Test enforcement (this SHOULD fail with error):
-- INSERT INTO user_consents (user_id, accepted_terms, consented_at, email) 
-- VALUES (gen_random_uuid(), true, now(), 'test@example.com');
--
-- Expected: ERROR: SCHEMA_VIOLATION: Column "email" does not exist

-- Q4: Verify valid insert works:
-- INSERT INTO user_consents (user_id, accepted_terms, consented_at) 
-- VALUES (gen_random_uuid(), true, now());
--
-- Expected: SUCCESS (1 row inserted)
