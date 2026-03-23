alter table public.automation_events
  drop constraint if exists automation_events_trigger_type_check;

alter table public.automation_events
  add constraint automation_events_trigger_type_check
  check (
    trigger_type in (
      'warranty_30_days',
      'maintenance_7_days',
      'service_log_created',
      'subscription_due',
      'expense_threshold',
      'document_expiry_reminder'
    )
  );

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  maintenance_days_before integer not null default 3,
  warranty_days_before integer not null default 3,
  document_days_before integer not null default 3,
  billing_days_before integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_settings_maintenance_days_before_check check (maintenance_days_before >= 0),
  constraint notification_settings_warranty_days_before_check check (warranty_days_before >= 0),
  constraint notification_settings_document_days_before_check check (document_days_before >= 0),
  constraint notification_settings_billing_days_before_check check (billing_days_before >= 0)
);

alter table public.notification_settings
  add column if not exists maintenance_days_before integer not null default 3,
  add column if not exists warranty_days_before integer not null default 3,
  add column if not exists document_days_before integer not null default 3,
  add column if not exists billing_days_before integer not null default 3,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

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

create index if not exists idx_notification_settings_updated_at
  on public.notification_settings(updated_at desc);

drop trigger if exists trg_notification_settings_updated_at on public.notification_settings;
create trigger trg_notification_settings_updated_at
before update on public.notification_settings
for each row
execute function public.set_updated_at();

alter table public.notification_settings enable row level security;

drop policy if exists "notification_settings_select_own" on public.notification_settings;
create policy "notification_settings_select_own" on public.notification_settings
for select using (auth.uid() = user_id);

drop policy if exists "notification_settings_insert_own" on public.notification_settings;
create policy "notification_settings_insert_own" on public.notification_settings
for insert with check (auth.uid() = user_id);

drop policy if exists "notification_settings_update_own" on public.notification_settings;
create policy "notification_settings_update_own" on public.notification_settings
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.notification_settings (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

drop function if exists public.emit_document_due_events();
drop function if exists public.emit_document_due_events(timestamptz, interval);

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
      'days_left', greatest(coalesce(settings.warranty_days_before, 3), 0)
    ),
    format('warranty-30d:%s:%s', asset.id, asset.warranty_end_date::text),
    run_at
  from public.assets asset
  left join public.notification_settings settings
    on settings.user_id = asset.user_id
  where asset.warranty_end_date is not null
    and ((asset.warranty_end_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.warranty_days_before, 3), 0))) <= run_at
    and ((asset.warranty_end_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.warranty_days_before, 3), 0))) > (run_at - due_window)
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
      'days_left', greatest(coalesce(settings.maintenance_days_before, 3), 0)
    ),
    format('maintenance-7d:%s:%s', rule.id, rule.next_due_date::text),
    run_at
  from public.maintenance_rules rule
  join public.assets asset
    on asset.id = rule.asset_id
  left join public.notification_settings settings
    on settings.user_id = rule.user_id
  where rule.is_active = true
    and rule.next_due_date is not null
    and ((rule.next_due_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.maintenance_days_before, 3), 0))) <= run_at
    and ((rule.next_due_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.maintenance_days_before, 3), 0))) > (run_at - due_window)
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
      'next_billing_date', sub.next_billing_date,
      'days_left', greatest(coalesce(settings.billing_days_before, 3), 0)
    ),
    format('subscription-due:%s:%s', sub.id, sub.next_billing_date::text),
    run_at
  from public.billing_subscriptions sub
  left join public.notification_settings settings
    on settings.user_id = sub.user_id
  where sub.status = 'active'
    and sub.next_billing_date is not null
    and ((sub.next_billing_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.billing_days_before, 3), 0))) <= run_at
    and ((sub.next_billing_date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.billing_days_before, 3), 0))) > (run_at - due_window)
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_document_due_events(
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
  expiry_column text := null;
begin
  if to_regclass('public.documents') is null then
    return 0;
  end if;

  select column_name
  into expiry_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'documents'
    and column_name in ('expiry_date', 'expires_at', 'document_expiry_date')
  order by case column_name
    when 'expiry_date' then 1
    when 'expires_at' then 2
    when 'document_expiry_date' then 3
    else 99
  end
  limit 1;

  if expiry_column is null then
    return 0;
  end if;

  execute format(
    $sql$
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
        doc.user_id,
        doc.asset_id,
        'document_expiry_reminder',
        array['email', 'push_notification']::text[],
        jsonb_build_object(
          'asset_name', asset.name,
          'document_type', doc.document_type,
          'file_name', doc.file_name,
          'expiry_date', doc.%1$I,
          'days_left', greatest(coalesce(settings.document_days_before, 3), 0)
        ),
        format('document-expiry:%s:%s', doc.id, doc.%1$I::date::text),
        $1
      from public.documents doc
      left join public.assets asset
        on asset.id = doc.asset_id
      left join public.notification_settings settings
        on settings.user_id = doc.user_id
      where doc.%1$I is not null
        and ((doc.%1$I::date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.document_days_before, 3), 0))) <= $1
        and ((doc.%1$I::date::timestamp at time zone 'UTC') - make_interval(days => greatest(coalesce(settings.document_days_before, 3), 0))) > ($1 - $2)
      on conflict (dedupe_key) do nothing
    $sql$,
    expiry_column
  )
  using run_at, due_window;

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
  document_count integer;
begin
  warranty_count := public.emit_warranty_due_events(run_at, due_window);
  maintenance_count := public.emit_maintenance_due_events(run_at, due_window);
  subscription_count := public.emit_subscription_due_events(run_at, due_window);
  document_count := public.emit_document_due_events(run_at, due_window);

  return jsonb_build_object(
    'warranty_30_days', warranty_count,
    'maintenance_7_days', maintenance_count,
    'subscription_due', subscription_count,
    'document_expiry_reminder', document_count
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
  days_before integer := 3;
begin
  if new.is_active is distinct from true or new.next_due_date is null then
    return new;
  end if;

  select greatest(coalesce(settings.maintenance_days_before, 3), 0)
  into days_before
  from public.notification_settings settings
  where settings.user_id = new.user_id;

  days_before := greatest(coalesce(days_before, 3), 0);
  due_at := (new.next_due_date::timestamp at time zone 'UTC') - make_interval(days => days_before);
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
      'days_left', days_before
    ),
    format('maintenance-7d:%s:%s', new.id, new.next_due_date::text),
    run_at
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;
