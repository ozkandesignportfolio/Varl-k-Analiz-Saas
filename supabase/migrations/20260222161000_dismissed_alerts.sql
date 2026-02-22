create extension if not exists pgcrypto;

create table if not exists public.dismissed_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alert_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, alert_key)
);

create index if not exists idx_dismissed_alerts_user_created_at
  on public.dismissed_alerts (user_id, created_at desc);

alter table public.dismissed_alerts enable row level security;

drop policy if exists "dismissed_alerts_select_own" on public.dismissed_alerts;
create policy "dismissed_alerts_select_own"
  on public.dismissed_alerts
  for select
  using (auth.uid() = user_id);

drop policy if exists "dismissed_alerts_insert_own" on public.dismissed_alerts;
create policy "dismissed_alerts_insert_own"
  on public.dismissed_alerts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "dismissed_alerts_update_own" on public.dismissed_alerts;
create policy "dismissed_alerts_update_own"
  on public.dismissed_alerts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dismissed_alerts_delete_own" on public.dismissed_alerts;
create policy "dismissed_alerts_delete_own"
  on public.dismissed_alerts
  for delete
  using (auth.uid() = user_id);
