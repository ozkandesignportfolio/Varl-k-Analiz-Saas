-- Extend automation events with new trigger types without rewriting existing schema.

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
      'expense_threshold'
    )
  );

create or replace function public.emit_subscription_due_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  emitted_count integer := 0;
begin
  if to_regclass('public.billing_subscriptions') is null then
    return 0;
  end if;

  insert into public.automation_events (
    user_id,
    trigger_type,
    actions,
    payload,
    dedupe_key
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
    format('subscription-due:%s:%s', sub.id, sub.next_billing_date::text)
  from public.billing_subscriptions sub
  where sub.status = 'active'
    and sub.next_billing_date is not null
    and sub.next_billing_date = current_date
  on conflict (dedupe_key) do nothing;

  get diagnostics emitted_count = row_count;
  return emitted_count;
end;
$$;

create or replace function public.emit_expense_threshold_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  threshold_amount numeric := 5000;
begin
  if coalesce(new.amount, 0) < threshold_amount then
    return new;
  end if;

  insert into public.automation_events (
    user_id,
    asset_id,
    trigger_type,
    actions,
    payload,
    dedupe_key
  )
  values (
    new.user_id,
    new.asset_id,
    'expense_threshold',
    array['email', 'push_notification']::text[],
    jsonb_build_object(
      'title', new.title,
      'category', new.category,
      'amount', new.amount,
      'currency', coalesce(new.currency, 'TRY'),
      'expense_date', new.expense_date,
      'threshold', threshold_amount
    ),
    format('expense-threshold:%s:%s', new.id, threshold_amount::text)
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.emit_expense_threshold_event() from public;
revoke all on function public.emit_expense_threshold_event() from anon;
revoke all on function public.emit_expense_threshold_event() from authenticated;
grant execute on function public.emit_expense_threshold_event() to service_role;

do $$
begin
  if to_regclass('public.expenses') is not null then
    execute 'drop trigger if exists trg_expense_threshold_event on public.expenses';
    execute 'create trigger trg_expense_threshold_event
      after insert on public.expenses
      for each row
      execute function public.emit_expense_threshold_event()';
  end if;
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
  subscription_count integer;
begin
  warranty_count := public.emit_warranty_due_events();
  maintenance_count := public.emit_maintenance_due_events();
  subscription_count := public.emit_subscription_due_events();

  return jsonb_build_object(
    'warranty_30_days', warranty_count,
    'maintenance_7_days', maintenance_count,
    'subscription_due', subscription_count
  );
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'automation_emit_subscription_due';

  perform cron.schedule(
    'automation_emit_subscription_due',
    '10 6 * * *',
    $cron$select public.emit_subscription_due_events();$cron$
  );
exception
  when undefined_table then
    null;
  when invalid_schema_name then
    null;
end;
$$;
