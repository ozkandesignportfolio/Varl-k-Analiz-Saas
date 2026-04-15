-- NOTIFICATIONS SYSTEM PRODUCTION FIXES
-- ======================================
-- Fixes: RLS policies, safety constraints, UTF-8 encoding

begin;

-- ============================================================
-- STEP 1: ENSURE NOTIFICATIONS TABLE HAS PROPER CONSTRAINTS
-- ============================================================

-- Ensure all required columns exist with proper defaults
alter table public.notifications 
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.notifications 
  add column if not exists user_id uuid not null references auth.users(id) on delete cascade;

alter table public.notifications 
  add column if not exists title text not null default 'Bildirim';

alter table public.notifications 
  add column if not exists message text not null default '';

alter table public.notifications 
  add column if not exists type text not null default 'Sistem';

alter table public.notifications 
  add column if not exists is_read boolean not null default false;

alter table public.notifications 
  add column if not exists source text not null default 'system';

alter table public.notifications 
  add column if not exists created_at timestamptz not null default now();

-- Update constraint to include all valid types
alter table public.notifications 
  drop constraint if exists notifications_type_check;

alter table public.notifications 
  add constraint notifications_type_check 
  check (type in ('Bakım', 'Garanti', 'Belge', 'Ödeme', 'Sistem'));

-- Update constraint for source
alter table public.notifications 
  drop constraint if exists notifications_source_check;

alter table public.notifications 
  add constraint notifications_source_check 
  check (source in ('system', 'automation', 'user_action'));

-- ============================================================
-- STEP 2: FIX RLS POLICIES (Clean slate + recreate)
-- ============================================================

alter table public.notifications enable row level security;

-- Drop all existing policies
alter table public.notifications disable row level security;
alter table public.notifications enable row level security;

-- Clean slate: drop all policies
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

-- POLICY 1: Users can SELECT only their own notifications
create policy notifications_select_own on public.notifications
  for select 
  using (auth.uid() = user_id);

-- POLICY 2: Users can INSERT their own notifications
-- (Note: System notifications should be inserted via service_role)
create policy notifications_insert_own on public.notifications
  for insert 
  with check (auth.uid() = user_id);

-- POLICY 3: Users can UPDATE only their own notifications (mark as read)
create policy notifications_update_own on public.notifications
  for update 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- POLICY 4: Users can DELETE only their own notifications
create policy notifications_delete_own on public.notifications
  for delete 
  using (auth.uid() = user_id);

-- ============================================================
-- STEP 3: GRANTS (Secure)
-- ============================================================

revoke all on public.notifications from anon, authenticated, public;

-- Authenticated users can access via RLS policies
grant select, insert, update, delete on public.notifications to authenticated;

-- Service role for system operations (welcome notification, etc.)
grant all on public.notifications to service_role;

-- ============================================================
-- STEP 4: SAFE RPC FUNCTIONS
-- ============================================================

-- Function to safely create notification (with idempotency check)
create or replace function public.create_notification_safe(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text default 'Sistem',
  p_source text default 'system',
  p_action_href text default null,
  p_action_label text default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification_id uuid;
  v_existing_id uuid;
begin
  -- Check for duplicate by idempotency key (if provided)
  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.notifications
    where user_id = p_user_id
    and source = p_source
    and title = p_title
    and created_at > now() - interval '1 hour'
    order by created_at desc
    limit 1;
    
    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;
  
  -- Insert new notification
  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    source,
    action_href,
    action_label,
    is_read
  ) values (
    p_user_id,
    p_title,
    p_message,
    coalesce(p_type, 'Sistem'),
    coalesce(p_source, 'system'),
    p_action_href,
    p_action_label,
    false
  )
  returning id into v_notification_id;
  
  return v_notification_id;
exception when others then
  -- Log error but don't crash
  raise warning 'create_notification_safe failed: %', sqlerrm;
  return null;
end;
$$;

-- Function to safely mark notification as read
create or replace function public.mark_notification_read_safe(
  p_notification_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_rows int;
begin
  update public.notifications
  set is_read = true,
      updated_at = now()
  where id = p_notification_id 
    and user_id = p_user_id
    and is_read = false;
  
  get diagnostics v_updated_rows = row_count;
  return v_updated_rows > 0;
exception when others then
  raise warning 'mark_notification_read_safe failed: %', sqlerrm;
  return false;
end;
$$;

-- Function to safely mark all notifications as read
create or replace function public.mark_all_notifications_read_safe(
  p_user_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_rows int;
begin
  update public.notifications
  set is_read = true,
      updated_at = now()
  where user_id = p_user_id 
    and is_read = false;
  
  get diagnostics v_updated_rows = row_count;
  return v_updated_rows;
exception when others then
  raise warning 'mark_all_notifications_read_safe failed: %', sqlerrm;
  return 0;
end;
$$;

-- Function to get unread count safely
create or replace function public.get_unread_notification_count_safe(
  p_user_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_count int;
begin
  select count(*)::int into v_count
  from public.notifications
  where user_id = p_user_id 
    and is_read = false;
  
  return coalesce(v_count, 0);
exception when others then
  raise warning 'get_unread_notification_count_safe failed: %', sqlerrm;
  return 0;
end;
$$;

-- ============================================================
-- STEP 5: GRANT EXECUTE PERMISSIONS
-- ============================================================

grant execute on function public.create_notification_safe(uuid, text, text, text, text, text, text, text) to service_role;
grant execute on function public.mark_notification_read_safe(uuid, uuid) to authenticated;
grant execute on function public.mark_all_notifications_read_safe(uuid) to authenticated;
grant execute on function public.get_unread_notification_count_safe(uuid) to authenticated;

-- ============================================================
-- STEP 6: REALTIME PUBLICATION
-- ============================================================

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
-- STEP 7: VERIFICATION
-- ============================================================

do $$
declare
  v_policy_count int;
  v_constraint_count int;
begin
  -- Verify policies exist
  select count(*) into v_policy_count
  from pg_policies
  where schemaname = 'public' 
    and tablename = 'notifications';
    
  if v_policy_count < 4 then
    raise exception 'NOTIFICATIONS_FIX_FAILED: Expected 4 RLS policies, found %', v_policy_count;
  end if;
  
  -- Verify constraints exist
  select count(*) into v_constraint_count
  from information_schema.table_constraints
  where table_schema = 'public'
    and table_name = 'notifications'
    and constraint_type = 'CHECK';
    
  raise notice 'NOTIFICATIONS_FIX_SUCCESS: % policies, % check constraints', v_policy_count, v_constraint_count;
end $$;

commit;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
