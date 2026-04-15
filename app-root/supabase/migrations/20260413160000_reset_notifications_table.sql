-- Database Hard Reset: Drop and recreate notifications table
-- Migration: 20260413160000
-- This migration safely resets the notifications table with the correct schema

-- Drop existing table if exists (with cascade to remove dependencies)
drop table if exists public.notifications cascade;

-- Create notifications table with simplified schema
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text default 'Sistem',
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Indexes for performance
comment on table public.notifications is 'User-facing in-app notifications (simplified schema)';

-- Index for fetching user's notifications
create index idx_notifications_user_id on public.notifications(user_id);

-- Index for unread count (critical for badge performance)
create index idx_notifications_is_read on public.notifications(is_read);

-- Index for ordering by created_at
create index idx_notifications_created_at on public.notifications(created_at desc);

-- Enable RLS
alter table public.notifications enable row level security;

-- RLS Policies

-- SELECT policy: Users can only read their own notifications
create policy "notifications_select_own"
  on public.notifications
  for select
  using (auth.uid() = user_id);

-- UPDATE policy: Users can only update their own notifications (mark as read)
create policy "notifications_update_own"
  on public.notifications
  for update
  using (auth.uid() = user_id);

-- INSERT policy: Service role can insert (used with admin client)
-- Note: This policy allows inserts from any authenticated context
-- The actual security is enforced by using service role client on server-side
create policy "notifications_insert_service"
  on public.notifications
  for insert
  with check (true);

-- DELETE policy: Users can only delete their own notifications
create policy "notifications_delete_own"
  on public.notifications
  for delete
  using (auth.uid() = user_id);

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
  set is_read = true
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
  set is_read = true
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

-- Add table to realtime publication (for live notifications)
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
end
$$;
