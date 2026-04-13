-- Create notifications table for in-app notifications
-- This table stores user-facing notifications separate from automation_events

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'Sistem' check (type in ('Bakım', 'Garanti', 'Belge', 'Ödeme', 'Sistem')),
  is_read boolean not null default false,
  action_href text,
  action_label text,
  source text not null default 'system' check (source in ('system', 'automation', 'user_action')),
  source_id uuid, -- optional reference to automation_events.id or other source
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Indexes for performance
comment on table public.notifications is 'User-facing in-app notifications';

-- Index for fetching user's notifications (most recent first)
create index if not exists idx_notifications_user_created 
  on public.notifications(user_id, created_at desc);

-- Index for unread count (critical for badge performance)
create index if not exists idx_notifications_user_unread 
  on public.notifications(user_id, is_read) 
  where is_read = false;

-- Index for type filtering
create index if not exists idx_notifications_user_type 
  on public.notifications(user_id, type, created_at desc);

-- Enable RLS
alter table public.notifications enable row level security;

-- RLS Policies: Users can only access their own notifications

-- SELECT policy
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- INSERT policy (for system/automation)
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own" on public.notifications
  for insert with check (auth.uid() = user_id);

-- UPDATE policy (only is_read and read_at)
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE policy
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (auth.uid() = user_id);

-- Function to create welcome notification on first login
-- Called from auth callback after email confirmation

-- Function to mark notification as read
create or replace function public.mark_notification_read(p_notification_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update public.notifications
  set is_read = true,
      read_at = now()
  where id = p_notification_id 
    and user_id = p_user_id
    and is_read = false;
  
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- Function to mark all notifications as read for a user
create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rows int;
begin
  update public.notifications
  set is_read = true,
      read_at = now()
  where user_id = p_user_id 
    and is_read = false;
  
  get diagnostics updated_rows = row_count;
  return updated_rows;
end;
$$;

-- Function to get unread count for a user
create or replace function public.get_unread_notification_count(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  count_result int;
begin
  select count(*)::int into count_result
  from public.notifications
  where user_id = p_user_id 
    and is_read = false;
  
  return count_result;
end;
$$;

-- Grant execute permissions
revoke all on function public.mark_notification_read(uuid, uuid) from anon, authenticated;
grant execute on function public.mark_notification_read(uuid, uuid) to authenticated;

revoke all on function public.mark_all_notifications_read(uuid) from anon, authenticated;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

revoke all on function public.get_unread_notification_count(uuid) from anon, authenticated;
grant execute on function public.get_unread_notification_count(uuid) to authenticated;

-- Function to create notification (for service role usage)
create or replace function public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type text default 'Sistem',
  p_action_href text default null,
  p_action_label text default null,
  p_source text default 'system',
  p_source_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.notifications (
    user_id,
    title,
    message,
    type,
    action_href,
    action_label,
    source,
    source_id
  ) values (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_action_href,
    p_action_label,
    p_source,
    p_source_id
  )
  returning id into new_id;
  
  return new_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, text, text, uuid) from anon, authenticated;
grant execute on function public.create_notification(uuid, text, text, text, text, text, text, uuid) to service_role;

-- Add realtime publication for notifications
-- Note: Run this after notifications table exists
do $$
begin
  -- Check if the table is already in the publication
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and schemaname = 'public' 
    and tablename = 'notifications'
  ) then
    -- Add table to realtime publication
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
