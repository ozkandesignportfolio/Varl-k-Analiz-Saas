-- UNIFIED USER ONBOARDING - PRODUCTION HARDENED
-- ============================================================
-- PURPOSE: Single source of truth for all user onboarding tables
-- STRATEGY: Idempotent operations, no duplicate key errors
-- PRINCIPLES:
--   - All tables use IF NOT EXISTS
--   - Primary keys match auth.users.id for consistency
--   - All inserts via application use upsert with onConflict
--   - Strict RLS policies for multi-tenant isolation
--   - No JavaScript in SQL (strict separation of concerns)
--
-- TABLES:
--   - profiles: User profile and subscription data
--   - user_consents: GDPR/KVKK compliance tracking
--   - notification_settings: User notification preferences
--   - notifications: In-app notification storage
-- ============================================================

begin;

-- ============================================================
-- STEP 1: EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- STEP 2: PROFILES TABLE (User profile & subscription)
-- ============================================================

create table if not exists public.profiles (
  id uuid not null primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column additions (for environments with partial schema)
alter table public.profiles 
  add column if not exists plan text not null default 'free' check (plan in ('free', 'premium'));

alter table public.profiles 
  add column if not exists stripe_customer_id text;

alter table public.profiles 
  add column if not exists stripe_subscription_id text;

alter table public.profiles 
  add column if not exists stripe_current_period_end timestamptz;

alter table public.profiles 
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles 
  add column if not exists updated_at timestamptz not null default now();

-- Indexes
create index if not exists idx_profiles_stripe_customer_id 
  on public.profiles(stripe_customer_id) 
  where stripe_customer_id is not null;

create index if not exists idx_profiles_stripe_subscription_id 
  on public.profiles(stripe_subscription_id) 
  where stripe_subscription_id is not null;

-- Trigger for updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;

-- Drop existing policies (clean slate)
do $$
declare
  pol record;
begin
  for pol in 
    select policyname 
    from pg_policies 
    where schemaname = 'public' 
    and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- RLS Policies: Users can only access their own profile
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No delete policy (profiles cascade delete with auth.users)

-- Grants
revoke all on public.profiles from anon, authenticated, public;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- ============================================================
-- STEP 3: USER_CONSENTS TABLE (GDPR/KVKK compliance)
-- ============================================================

create table if not exists public.user_consents (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null default true,
  consented_at timestamptz not null default now()
);

-- Idempotent column additions
alter table public.user_consents 
  add column if not exists accepted_terms boolean not null default true;

alter table public.user_consents 
  add column if not exists consented_at timestamptz not null default now();

-- Unique index (enforces one consent per user, enables upsert)
create unique index if not exists idx_user_consents_user_id 
  on public.user_consents(user_id);

-- RLS
alter table public.user_consents enable row level security;

-- Clean slate policies
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

-- RLS Policies
create policy user_consents_select_own on public.user_consents
  for select using (auth.uid() = user_id);

create policy user_consents_insert_own on public.user_consents
  for insert with check (auth.uid() = user_id);

create policy user_consents_update_own on public.user_consents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants
revoke all on public.user_consents from anon, authenticated, public;
grant select, insert, update on public.user_consents to authenticated;
grant all on public.user_consents to service_role;

-- ============================================================
-- STEP 4: NOTIFICATION_SETTINGS TABLE
-- ============================================================

create table if not exists public.notification_settings (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  maintenance_days_before integer not null default 3 check (maintenance_days_before >= 0),
  warranty_days_before integer not null default 3 check (warranty_days_before >= 0),
  document_days_before integer not null default 3 check (document_days_before >= 0),
  billing_days_before integer not null default 3 check (billing_days_before >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Idempotent column additions
alter table public.notification_settings 
  add column if not exists maintenance_days_before integer not null default 3 check (maintenance_days_before >= 0);

alter table public.notification_settings 
  add column if not exists warranty_days_before integer not null default 3 check (warranty_days_before >= 0);

alter table public.notification_settings 
  add column if not exists document_days_before integer not null default 3 check (document_days_before >= 0);

alter table public.notification_settings 
  add column if not exists billing_days_before integer not null default 3 check (billing_days_before >= 0);

alter table public.notification_settings 
  add column if not exists created_at timestamptz not null default now();

alter table public.notification_settings 
  add column if not exists updated_at timestamptz not null default now();

-- Drop and recreate constraints safely
alter table public.notification_settings 
  drop constraint if exists notification_settings_maintenance_days_before_check;
alter table public.notification_settings 
  add constraint notification_settings_maintenance_days_before_check 
  check (maintenance_days_before >= 0);

alter table public.notification_settings 
  drop constraint if exists notification_settings_warranty_days_before_check;
alter table public.notification_settings 
  add constraint notification_settings_warranty_days_before_check 
  check (warranty_days_before >= 0);

alter table public.notification_settings 
  drop constraint if exists notification_settings_document_days_before_check;
alter table public.notification_settings 
  add constraint notification_settings_document_days_before_check 
  check (document_days_before >= 0);

alter table public.notification_settings 
  drop constraint if exists notification_settings_billing_days_before_check;
alter table public.notification_settings 
  add constraint notification_settings_billing_days_before_check 
  check (billing_days_before >= 0);

-- Index
create index if not exists idx_notification_settings_updated_at
  on public.notification_settings(updated_at desc);

-- Trigger
drop trigger if exists trg_notification_settings_updated_at on public.notification_settings;
create trigger trg_notification_settings_updated_at
  before update on public.notification_settings
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.notification_settings enable row level security;

-- Clean slate policies
do $$
declare
  pol record;
begin
  for pol in 
    select policyname 
    from pg_policies 
    where schemaname = 'public' 
    and tablename = 'notification_settings'
  loop
    execute format('drop policy if exists %I on public.notification_settings', pol.policyname);
  end loop;
end $$;

-- RLS Policies
create policy notification_settings_select_own on public.notification_settings
  for select using (auth.uid() = user_id);

create policy notification_settings_insert_own on public.notification_settings
  for insert with check (auth.uid() = user_id);

create policy notification_settings_update_own on public.notification_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants
revoke all on public.notification_settings from anon, authenticated, public;
grant select, insert, update on public.notification_settings to authenticated;
grant all on public.notification_settings to service_role;

-- ============================================================
-- STEP 5: NOTIFICATIONS TABLE (In-app notifications)
-- ============================================================

create table if not exists public.notifications (
  id uuid not null primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'Sistem' check (type in ('Bakım', 'Garanti', 'Belge', 'Ödeme', 'Sistem')),
  is_read boolean not null default false,
  action_href text,
  action_label text,
  source text not null default 'system' check (source in ('system', 'automation', 'user_action')),
  source_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Idempotent column additions
alter table public.notifications 
  add column if not exists type text not null default 'Sistem' check (type in ('Bakım', 'Garanti', 'Belge', 'Ödeme', 'Sistem'));

alter table public.notifications 
  add column if not exists source text not null default 'system' check (source in ('system', 'automation', 'user_action'));

alter table public.notifications 
  add column if not exists source_id uuid;

-- Indexes
create index if not exists idx_notifications_user_created 
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread 
  on public.notifications(user_id, is_read) 
  where is_read = false;

create index if not exists idx_notifications_user_type 
  on public.notifications(user_id, type, created_at desc);

-- RLS
alter table public.notifications enable row level security;

-- Clean slate policies
do $$
declare
  pol record;
begin
  for pol in 
    select policyname 
    from pg_policies 
    where schemaname = 'public' 
    and tablename = 'notifications'
  loop
    execute format('drop policy if exists %I on public.notifications', pol.policyname);
  end loop;
end $$;

-- RLS Policies
create policy notifications_select_own on public.notifications
  for select using (auth.uid() = user_id);

create policy notifications_insert_own on public.notifications
  for insert with check (auth.uid() = user_id);

create policy notifications_update_own on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy notifications_delete_own on public.notifications
  for delete using (auth.uid() = user_id);

-- Grants
revoke all on public.notifications from anon, authenticated, public;
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- Realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ============================================================
-- STEP 6: HELPER FUNCTIONS (Idempotent operations)
-- ============================================================

-- Function to safely upsert user consent
create or replace function public.upsert_user_consent(
  p_user_id uuid,
  p_accepted_terms boolean default true,
  p_consented_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_xmin bigint;
begin
  insert into public.user_consents (user_id, accepted_terms, consented_at)
  values (p_user_id, p_accepted_terms, p_consented_at)
  on conflict (user_id) do update set
    accepted_terms = excluded.accepted_terms,
    consented_at = excluded.consented_at
  returning to_jsonb(user_consents.*), xmin into v_result, v_xmin;
  
  return jsonb_build_object(
    'success', true,
    'data', v_result,
    'operation', case when v_xmin = 0 then 'insert' else 'update' end
  );
exception when others then
  return jsonb_build_object(
    'success', false,
    'error', sqlerrm,
    'code', sqlstate
  );
end;
$$;

-- Function to create welcome notification
create or replace function public.create_welcome_notification(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
begin
  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    source,
    action_href,
    action_label
  ) values (
    p_user_id,
    'Hoş geldiniz',
    'Assetly''ye hoş geldiniz! Bildirim sistemi aktif.',
    'Sistem',
    'system',
    '/assets',
    'Varlıklarım'
  )
  returning id into v_notification_id;
  
  return v_notification_id;
exception when others then
  -- Silently fail - welcome notification is not critical
  return null;
end;
$$;

-- Function to bootstrap all user records (idempotent)
create or replace function public.bootstrap_user_records(
  p_user_id uuid,
  p_accepted_terms boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_exists boolean;
  v_consent_result jsonb;
  v_notification_id uuid;
  v_result jsonb;
begin
  -- Check if profile exists
  select exists(
    select 1 from public.profiles where id = p_user_id
  ) into v_profile_exists;
  
  -- Upsert profile
  insert into public.profiles (id, plan)
  values (p_user_id, 'free')
  on conflict (id) do nothing;
  
  -- Upsert notification settings
  insert into public.notification_settings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;
  
  -- Upsert user consent
  select public.upsert_user_consent(p_user_id, p_accepted_terms, now()) into v_consent_result;
  
  -- Create welcome notification only for new users
  if not v_profile_exists then
    select public.create_welcome_notification(p_user_id) into v_notification_id;
  end if;
  
  return jsonb_build_object(
    'success', true,
    'is_new_user', not v_profile_exists,
    'welcome_notification_id', v_notification_id,
    'consent', v_consent_result
  );
exception when others then
  return jsonb_build_object(
    'success', false,
    'error', sqlerrm,
    'code', sqlstate
  );
end;
$$;

-- Grant execute permissions
revoke all on function public.upsert_user_consent(uuid, boolean, timestamptz) from anon, authenticated;
grant execute on function public.upsert_user_consent(uuid, boolean, timestamptz) to service_role;

revoke all on function public.create_welcome_notification(uuid) from anon, authenticated;
grant execute on function public.create_welcome_notification(uuid) to service_role;

revoke all on function public.bootstrap_user_records(uuid, boolean) from anon, authenticated;
grant execute on function public.bootstrap_user_records(uuid, boolean) to service_role;

-- ============================================================
-- STEP 7: VERIFICATION
-- ============================================================

do $$
declare
  v_missing_tables text[];
  v_missing_policies int;
begin
  -- Verify all tables exist
  select array_agg(t.table_name)
  into v_missing_tables
  from (
    values ('profiles'), ('user_consents'), ('notification_settings'), ('notifications')
  ) as t(table_name)
  where not exists (
    select 1 from information_schema.tables 
    where table_schema = 'public' 
    and table_name = t.table_name
  );
  
  if v_missing_tables is not null then
    raise exception 'UNIFIED_ONBOARDING_FAILED: Missing tables: %', v_missing_tables;
  end if;
  
  -- Verify minimum policy count
  select count(*) into v_missing_policies
  from pg_policies
  where schemaname = 'public' 
  and tablename in ('profiles', 'user_consents', 'notification_settings', 'notifications');
  
  if v_missing_policies < 12 then
    raise exception 'UNIFIED_ONBOARDING_FAILED: Expected at least 12 RLS policies, found %', v_missing_policies;
  end if;
  
  raise notice 'UNIFIED_ONBOARDING_SUCCESS: All tables and policies verified (% policies)', v_missing_policies;
end $$;

commit;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
