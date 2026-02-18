-- Notification flow hardening using existing tables only:
-- - maintenance_rules as rule source (CRUD handled in API)
-- - automation_events as queue
-- - dedupe_key unique index as duplicate guard

drop function if exists public.emit_warranty_due_events();
drop function if exists public.emit_warranty_due_events(timestamptz, interval);
drop function if exists public.emit_maintenance_due_events();
drop function if exists public.emit_maintenance_due_events(timestamptz, interval);
drop function if exists public.emit_subscription_due_events();
drop function if exists public.emit_subscription_due_events(timestamptz, interval);
drop function if exists public.emit_due_automation_events();
drop function if exists public.emit_due_automation_events(timestamptz, interval);

create or replace function public.normalize_due_window(p_window interval)
returns interval
language sql
immutable
as $$
  select greatest(coalesce(p_window, interval '1 day'), interval '1 minute');
$$;

create or replace function public.emit_warranty_due_events(
  p_run_at timestamptz default now(),
  p_window interval default interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
  run_at timestamptz := coalesce(p_run_at, now());
  due_window interval := public.normalize_due_window(p_window);
begin
  insert into public.automation_events (
    user_id,
    asset_id,
    trigger_type,
    actions,
    payload,
    dedupe_key,
    run_after
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
    format('warranty-30d:%s:%s', asset.id, asset.warranty_end_date::text),
    run_at
  from public.assets asset
  where asset.warranty_end_date is not null
    and ((asset.warranty_end_date::timestamp at time zone 'UTC') - interval '30 day') <= run_at
    and ((asset.warranty_end_date::timestamp at time zone 'UTC') - interval '30 day') > (run_at - due_window)
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_maintenance_due_events(
  p_run_at timestamptz default now(),
  p_window interval default interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
  run_at timestamptz := coalesce(p_run_at, now());
  due_window interval := public.normalize_due_window(p_window);
begin
  insert into public.automation_events (
    user_id,
    asset_id,
    rule_id,
    trigger_type,
    actions,
    payload,
    dedupe_key,
    run_after
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
    format('maintenance-7d:%s:%s', rule.id, rule.next_due_date::text),
    run_at
  from public.maintenance_rules rule
  join public.assets asset
    on asset.id = rule.asset_id
  where rule.is_active = true
    and rule.next_due_date is not null
    and ((rule.next_due_date::timestamp at time zone 'UTC') - interval '7 day') <= run_at
    and ((rule.next_due_date::timestamp at time zone 'UTC') - interval '7 day') > (run_at - due_window)
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_subscription_due_events(
  p_run_at timestamptz default now(),
  p_window interval default interval '1 day'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
  run_at timestamptz := coalesce(p_run_at, now());
  due_window interval := public.normalize_due_window(p_window);
begin
  if to_regclass('public.billing_subscriptions') is null then
    return 0;
  end if;

  insert into public.automation_events (
    user_id,
    trigger_type,
    actions,
    payload,
    dedupe_key,
    run_after
  )
  select
    sub.user_id,
    'subscription_due',
    array['email', 'push_notification']::text[],
    jsonb_build_object(
      'provider_name', sub.provider_name,
      'subscription_name', sub.subscription_name,
      'plan_name', sub.plan_name,
      'billing_cycle', sub.billing_cycle,
      'amount', sub.amount,
      'currency', sub.currency,
      'next_billing_date', sub.next_billing_date
    ),
    format('subscription-due:%s:%s', sub.id, sub.next_billing_date::text),
    run_at
  from public.billing_subscriptions sub
  where sub.status = 'active'
    and sub.next_billing_date is not null
    and (sub.next_billing_date::timestamp at time zone 'UTC') <= run_at
    and (sub.next_billing_date::timestamp at time zone 'UTC') > (run_at - due_window)
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_due_automation_events(
  p_run_at timestamptz default now(),
  p_window interval default interval '1 day'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_at timestamptz := coalesce(p_run_at, now());
  due_window interval := public.normalize_due_window(p_window);
  warranty_count integer;
  maintenance_count integer;
  subscription_count integer;
begin
  warranty_count := public.emit_warranty_due_events(run_at, due_window);
  maintenance_count := public.emit_maintenance_due_events(run_at, due_window);
  subscription_count := public.emit_subscription_due_events(run_at, due_window);

  return jsonb_build_object(
    'warranty_30_days', warranty_count,
    'maintenance_7_days', maintenance_count,
    'subscription_due', subscription_count
  );
end;
$$;

create or replace function public.enqueue_maintenance_due_event_on_rule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  run_at timestamptz := now();
  due_at timestamptz;
  asset_name text;
begin
  if new.is_active is distinct from true or new.next_due_date is null then
    return new;
  end if;

  due_at := (new.next_due_date::timestamp at time zone 'UTC') - interval '7 day';
  if due_at > run_at then
    return new;
  end if;

  select name into asset_name
  from public.assets
  where id = new.asset_id;

  insert into public.automation_events (
    user_id,
    asset_id,
    rule_id,
    trigger_type,
    actions,
    payload,
    dedupe_key,
    run_after
  )
  values (
    new.user_id,
    new.asset_id,
    new.id,
    'maintenance_7_days',
    array['email', 'push_notification', 'pdf_report']::text[],
    jsonb_build_object(
      'rule_title', new.title,
      'asset_name', coalesce(asset_name, ''),
      'next_due_date', new.next_due_date,
      'days_left', 7
    ),
    format('maintenance-7d:%s:%s', new.id, new.next_due_date::text),
    run_at
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_maintenance_rule_due_event_on_change on public.maintenance_rules;
create trigger trg_maintenance_rule_due_event_on_change
after insert or update of next_due_date, is_active, title, asset_id on public.maintenance_rules
for each row
execute function public.enqueue_maintenance_due_event_on_rule_change();

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in (
    'automation_emit_warranty_30d',
    'automation_emit_maintenance_7d',
    'automation_emit_subscription_due',
    'automation_emit_due_events'
  );

  perform cron.schedule(
    'automation_emit_due_events',
    '*/15 * * * *',
    $cron$select public.emit_due_automation_events(now(), interval '1 day');$cron$
  );
exception
  when undefined_table then
    null;
  when invalid_schema_name then
    null;
end;
$$;
