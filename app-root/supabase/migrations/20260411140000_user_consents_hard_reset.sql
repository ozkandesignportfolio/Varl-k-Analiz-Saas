-- USER_CONSENTS HARD RESET MIGRATION
-- ===================================
-- Purpose: Complete schema reset to eliminate all drift
-- Strategy: DROP and RECREATE table with clean 3-column schema
-- WARNING: This deletes all existing consent data (acceptable for pre-launch)

begin;

-- Step 1: Complete table drop (cascades indexes, constraints, policies)
drop table if exists public.user_consents cascade;

-- Step 2: Recreate table with EXACT 3-column schema
-- No id column - user_id is PK
-- No metadata columns - audit trail in auth_security_logs
-- No multiple consent fields - single accepted_terms covers all legal requirements

create table public.user_consents (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null,
  consented_at timestamptz not null default now()
);

-- Step 3: Create minimal required index
-- Unique index on user_id ensures one consent record per user
-- Also serves as lookup index
CREATE UNIQUE INDEX idx_user_consents_user_id ON public.user_consents(user_id);

-- Step 4: Security
alter table public.user_consents enable row level security;

-- Revoke all from public roles (defense in depth)
revoke all on table public.user_consents from anon, authenticated, public;

-- Grant only to service_role (backend only access)
grant select, insert, update, delete on table public.user_consents to service_role;

-- Step 5: Schema verification (fails if anything is wrong)
do $$
declare
  col_count integer;
  col_record record;
  expected_columns text[] := array['user_id', 'accepted_terms', 'consented_at'];
  actual_columns text[];
begin
  -- Get column list
  select array_agg(column_name::text order by ordinal_position)
  into actual_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_consents';
  
  -- Verify column count
  select count(*) into col_count
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'user_consents';
  
  if col_count != 3 then
    raise exception 'SCHEMA RESET FAILED: Expected 3 columns, found %', col_count;
  end if;
  
  -- Verify exact column names
  if actual_columns != expected_columns then
    raise exception 'SCHEMA RESET FAILED: Column mismatch. Expected: %, Found: %', 
      expected_columns, actual_columns;
  end if;
  
  -- Verify primary key on user_id
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_consents'::regclass
      and contype = 'p'
      and conkey = (select array_agg(attnum) from pg_attribute 
                    where attrelid = 'public.user_consents'::regclass 
                    and attname = 'user_id')
  ) then
    raise exception 'SCHEMA RESET FAILED: Primary key not on user_id';
  end if;
  
  -- Verify foreign key to auth.users
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_consents'
      and constraint_type = 'FOREIGN KEY'
  ) then
    raise exception 'SCHEMA RESET FAILED: Foreign key missing';
  end if;
  
  raise notice 'SCHEMA RESET VERIFIED: user_consents table has correct 3-column structure';
end $$;

-- Step 6: Force schema cache refresh
-- Notify PostgreSQL to invalidate cached plans
select pg_notify('pgrst', 'reload schema');

commit;

-- Post-migration verification query (run separately if needed):
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'user_consents' 
-- ORDER BY ordinal_position;
