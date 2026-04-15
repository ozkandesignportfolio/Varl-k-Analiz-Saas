-- USER_CONSENTS IDEMPOTENT FIX
-- ======================================
-- PURPOSE: Production-safe, idempotent user_consents table
-- STRATEGY: CREATE IF NOT EXISTS + ON CONFLICT handling
--
-- SCHEMA:
--   user_id: uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
--   accepted_terms: boolean NOT NULL DEFAULT true
--   consented_at: timestamptz NOT NULL DEFAULT now()
--
-- IDEMPOTENCY:
--   - Table creation uses IF NOT EXISTS
--   - UPSERT operations use ON CONFLICT DO UPDATE
--   - No duplicate key errors possible

-- ============================================================
-- STEP 1: ENSURE TABLE EXISTS (Idempotent)
-- ============================================================

do $$
begin
  -- Create table if it doesn't exist
  create table if not exists public.user_consents (
    user_id uuid not null primary key references auth.users(id) on delete cascade,
    accepted_terms boolean not null default true,
    consented_at timestamptz not null default now()
  );
  
  -- Ensure columns exist (idempotent column addition)
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'user_consents' 
      and column_name = 'accepted_terms'
  ) then
    alter table public.user_consents add column accepted_terms boolean not null default true;
  end if;
  
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'user_consents' 
      and column_name = 'consented_at'
  ) then
    alter table public.user_consents add column consented_at timestamptz not null default now();
  end if;
end $$;

-- ============================================================
-- STEP 2: ENSURE INDEXES (Idempotent)
-- ============================================================

-- Unique index for upsert operations (enforces one consent per user)
create unique index if not exists idx_user_consents_user_id 
on public.user_consents(user_id);

-- ============================================================
-- STEP 3: ENABLE RLS (Idempotent)
-- ============================================================

alter table public.user_consents enable row level security;

-- ============================================================
-- STEP 4: RLS POLICIES (Drop and Recreate for Clean State)
-- ============================================================

-- Drop existing policies to ensure clean state
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

-- POLICY: Users can UPDATE only their own consent record
create policy user_consents_update_own
on public.user_consents
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ============================================================
-- STEP 5: GRANTS (Idempotent)
-- ============================================================

-- Revoke all from public roles
revoke all on table public.user_consents from anon, authenticated, public;

-- Grant authenticated users access via RLS policies (they can't access directly)
-- Grant service_role full access for server-side operations
grant select, insert, update, delete on table public.user_consents to service_role;

-- ============================================================
-- STEP 6: CREATE HELPER FUNCTION FOR IDEMPOTENT INSERT
-- ============================================================

-- Function to safely upsert user consent (handles all edge cases)
create or replace function public.upsert_user_consent(
  p_user_id uuid,
  p_accepted_terms boolean default true,
  p_consented_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  insert into public.user_consents (user_id, accepted_terms, consented_at)
  values (p_user_id, p_accepted_terms, p_consented_at)
  on conflict (user_id) do update set
    accepted_terms = excluded.accepted_terms,
    consented_at = excluded.consented_at
  returning to_jsonb(user_consents.*) into v_result;
  
  return jsonb_build_object(
    'success', true,
    'data', v_result,
    'operation', case when xmax = 0 then 'insert' else 'update' end
  );
exception when others then
  return jsonb_build_object(
    'success', false,
    'error', sqlerrm,
    'code', sqlstate
  );
end;
$$;

-- ============================================================
-- STEP 7: VERIFICATION
-- ============================================================

do $$
declare
  col_count integer;
  expected_columns text[] := array['user_id', 'accepted_terms', 'consented_at'];
  actual_columns text[];
  policy_count integer;
begin
  -- Count columns
  select count(*) into col_count
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  if col_count != 3 then
    raise exception 'SCHEMA_FIX_FAILED: Expected 3 columns, found %', col_count;
  end if;
  
  -- Get actual column names
  select array_agg(column_name::text order by ordinal_position)
  into actual_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_consents';
  
  -- Verify exact column names
  if actual_columns != expected_columns then
    raise exception 'SCHEMA_FIX_FAILED: Column mismatch. Expected: %, Got: %', 
      expected_columns, actual_columns;
  end if;
  
  -- Verify RLS policies exist
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' 
    and tablename = 'user_consents';
    
  if policy_count < 3 then
    raise exception 'SCHEMA_FIX_FAILED: Expected at least 3 RLS policies, found %', policy_count;
  end if;
  
  raise notice 'SCHEMA_FIX_SUCCESS: user_consents table verified with % columns, % RLS policies', col_count, policy_count;
end $$;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
