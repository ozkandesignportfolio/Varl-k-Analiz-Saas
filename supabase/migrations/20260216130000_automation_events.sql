create extension if not exists pg_cron;

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions(user_id, is_active);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own" on public.push_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own" on public.push_subscriptions
for insert with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own" on public.push_subscriptions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own" on public.push_subscriptions
for delete using (auth.uid() = user_id);

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete set null,
  rule_id uuid references public.maintenance_rules(id) on delete set null,
  service_log_id uuid references public.service_logs(id) on delete set null,
  trigger_type text not null check (trigger_type in ('warranty_30_days', 'maintenance_7_days', 'service_log_created')),
  actions text[] not null check (actions <@ array['email', 'push', 'push_notification', 'pdf_report']::text[]),
  payload jsonb not null default '{}'::jsonb,
  action_results jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  dedupe_key text not null unique,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists idx_automation_events_pending
  on public.automation_events(status, run_after, created_at)
  where status in ('pending', 'processing');

create index if not exists idx_automation_events_user
  on public.automation_events(user_id, created_at desc);

alter table public.automation_events enable row level security;

drop policy if exists "automation_events_select_own" on public.automation_events;
create policy "automation_events_select_own" on public.automation_events
for select using (auth.uid() = user_id);

create or replace function public.claim_automation_events(p_limit int default 50)
returns setof public.automation_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.automation_events
    where status = 'pending'
      and run_after <= now()
    order by created_at
    limit greatest(coalesce(p_limit, 50), 1)
    for update skip locked
  ),
  updated as (
    update public.automation_events target
    set status = 'processing'
    from candidates
    where target.id = candidates.id
    returning target.*
  )
  select * from updated;
end;
$$;

revoke all on function public.claim_automation_events(int) from anon, authenticated;
grant execute on function public.claim_automation_events(int) to service_role;

create or replace function public.emit_service_log_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.automation_events (
    user_id,
    asset_id,
    rule_id,
    service_log_id,
    trigger_type,
    actions,
    payload,
    dedupe_key
  )
  values (
    new.user_id,
    new.asset_id,
    new.rule_id,
    new.id,
    'service_log_created',
    array['email', 'push_notification', 'pdf_report']::text[],
    jsonb_build_object(
      'service_type', new.service_type,
      'service_date', new.service_date,
      'cost', new.cost,
      'provider', new.provider
    ),
    format('service-log-created:%s', new.id)
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_service_log_created_event on public.service_logs;
create trigger trg_service_log_created_event
after insert on public.service_logs
for each row
execute function public.emit_service_log_created_event();

create or replace function public.emit_warranty_due_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
begin
  insert into public.automation_events (
    user_id,
    asset_id,
    trigger_type,
    actions,
    payload,
    dedupe_key
  )
  select
    asset.user_id,
    asset.id,
    'warranty_30_days',
    array['email', 'push_notification', 'pdf_report']::text[],
    jsonb_build_object(
      'asset_name', asset.name,
      'warranty_end_date', asset.warranty_end_date,
      'days_left', 30
    ),
    format('warranty-30d:%s:%s', asset.id, asset.warranty_end_date::text)
  from public.assets asset
  where asset.warranty_end_date is not null
    and asset.warranty_end_date = (current_date + interval '30 day')::date
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_maintenance_due_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
begin
  insert into public.automation_events (
    user_id,
    asset_id,
    rule_id,
    trigger_type,
    actions,
    payload,
    dedupe_key
  )
  select
    rule.user_id,
    rule.asset_id,
    rule.id,
    'maintenance_7_days',
    array['email', 'push_notification', 'pdf_report']::text[],
    jsonb_build_object(
      'rule_title', rule.title,
      'asset_name', asset.name,
      'next_due_date', rule.next_due_date,
      'days_left', 7
    ),
    format('maintenance-7d:%s:%s', rule.id, rule.next_due_date::text)
  from public.maintenance_rules rule
  join public.assets asset
    on asset.id = rule.asset_id
  where rule.is_active = true
    and rule.next_due_date = (current_date + interval '7 day')::date
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_due_automation_events()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  warranty_count integer;
  maintenance_count integer;
begin
  warranty_count := public.emit_warranty_due_events();
  maintenance_count := public.emit_maintenance_due_events();

  return jsonb_build_object(
    'warranty_30_days', warranty_count,
    'maintenance_7_days', maintenance_count
  );
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in ('automation_emit_warranty_30d', 'automation_emit_maintenance_7d');

  perform cron.schedule(
    'automation_emit_warranty_30d',
    '0 6 * * *',
    $cron$select public.emit_warranty_due_events();$cron$
  );

  perform cron.schedule(
    'automation_emit_maintenance_7d',
    '5 6 * * *',
    $cron$select public.emit_maintenance_due_events();$cron$
  );
end;
$$;
