begin;

create extension if not exists pg_cron;

create table if not exists public.global_metrics_cache (
  key text primary key,
  payload jsonb not null,
  computed_at timestamptz not null
);

alter table public.global_metrics_cache enable row level security;

drop policy if exists "global_metrics_cache_select_all" on public.global_metrics_cache;
create policy "global_metrics_cache_select_all"
on public.global_metrics_cache
for select
using (true);

drop policy if exists "global_metrics_cache_service_role_manage" on public.global_metrics_cache;
create policy "global_metrics_cache_service_role_manage"
on public.global_metrics_cache
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on table public.global_metrics_cache from anon;
revoke all on table public.global_metrics_cache from authenticated;
grant select on table public.global_metrics_cache to anon;
grant select on table public.global_metrics_cache to authenticated;
grant all on table public.global_metrics_cache to service_role;

create or replace function public.compute_global_metrics_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_now timestamptz := now();
  v_since timestamptz := v_now - interval '30 days';

  v_active_users int := 0;
  v_tracked_assets int := 0;
  v_service_log_count int := 0;
  v_invoice_count int := 0;
  v_completed_transactions int := 0;

  v_has_billing_invoices boolean := to_regclass('public.billing_invoices') is not null;
  v_has_expenses boolean := to_regclass('public.expenses') is not null;
  v_has_health_score_column boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assets'
      and column_name = 'health_score'
  );

  v_health_rate numeric := 0;
  v_maintenance_cost numeric := 0;
  v_expense_cost numeric := 0;
  v_asset_price numeric := 0;
  v_total_cost numeric := 0;
  v_ratio numeric := 0;
begin
  select count(*)::int
  into v_active_users
  from auth.users u
  where coalesce(u.last_sign_in_at, u.updated_at) >= v_since;

  select count(*)::int
  into v_tracked_assets
  from public.assets;

  select count(*)::int
  into v_service_log_count
  from public.service_logs;

  if v_has_billing_invoices then
    select count(*)::int
    into v_invoice_count
    from public.billing_invoices;
  end if;

  v_completed_transactions := v_service_log_count + v_invoice_count;

  if v_has_health_score_column then
    execute 'select coalesce(avg(health_score), 0)::numeric from public.assets'
    into v_health_rate;
  else
    select coalesce(sum(cost), 0)::numeric
    into v_maintenance_cost
    from public.service_logs;

    if v_has_expenses then
      with
        expenses_scoped as (
          select
            asset_id,
            coalesce(amount, 0)::numeric as amount,
            lower(coalesce(category, '') || ' ' || coalesce(note, '')) as search_text
          from public.expenses
          where coalesce(amount, 0) > 0
        ),
        expenses_per_asset as (
          select
            asset_id,
            coalesce(
              max(amount) filter (
                where search_text like '%satin alma%'
                   or search_text like '%purchase%'
                   or search_text like '%urun%'
                   or search_text like '%cihaz%'
                   or search_text like '%fiyat%'
                   or search_text like '%bedel%'
              ),
              max(amount),
              0
            )::numeric as derived_asset_price
          from expenses_scoped
          where asset_id is not null
          group by asset_id
        )
      select
        coalesce((select sum(amount) from expenses_scoped), 0)::numeric,
        coalesce((select sum(derived_asset_price) from expenses_per_asset), 0)::numeric
      into v_expense_cost, v_asset_price;
    end if;

    v_total_cost := v_maintenance_cost + v_expense_cost;
    if v_total_cost <= 0 then
      v_health_rate := 100;
    else
      v_ratio := v_asset_price / nullif(v_total_cost, 0);
      v_health_rate := case
        when v_ratio < 1 then 20
        when v_ratio <= 2 then 40
        when v_ratio <= 4 then 60
        when v_ratio <= 8 then 80
        else 95
      end;
    end if;
  end if;

  return jsonb_build_object(
    'activeUsers', greatest(0, v_active_users),
    'trackedAssets', greatest(0, v_tracked_assets),
    'completedTransactions', greatest(0, v_completed_transactions),
    'systemHealthRate', least(100, greatest(0, round(v_health_rate)::int)),
    'scope', 'global',
    'generatedAt', v_now
  );
end;
$$;

create or replace function public.refresh_global_metrics_cache(p_key text default 'dashboard')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_claim_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  v_key text := coalesce(nullif(p_key, ''), 'dashboard');
  v_now timestamptz := now();
  v_existing_payload jsonb;
  v_existing_computed_at timestamptz;
  v_payload jsonb;
begin
  if v_claim_role is not null and v_claim_role <> 'service_role' then
    raise exception 'refresh_global_metrics_cache can only be called by service_role'
      using errcode = '42501';
  end if;

  select payload, computed_at
  into v_existing_payload, v_existing_computed_at
  from public.global_metrics_cache
  where key = v_key;

  if v_existing_computed_at is not null and v_existing_computed_at >= (v_now - interval '1 minute') then
    return v_existing_payload;
  end if;

  v_payload := public.compute_global_metrics_snapshot();

  insert into public.global_metrics_cache as c (key, payload, computed_at)
  values (v_key, v_payload, v_now)
  on conflict (key) do update
    set payload = excluded.payload,
        computed_at = excluded.computed_at;

  return v_payload;
end;
$$;

revoke all on function public.compute_global_metrics_snapshot() from public;
revoke all on function public.compute_global_metrics_snapshot() from anon;
revoke all on function public.compute_global_metrics_snapshot() from authenticated;
grant execute on function public.compute_global_metrics_snapshot() to service_role;

revoke all on function public.refresh_global_metrics_cache(text) from public;
revoke all on function public.refresh_global_metrics_cache(text) from anon;
revoke all on function public.refresh_global_metrics_cache(text) from authenticated;
grant execute on function public.refresh_global_metrics_cache(text) to service_role;

select public.refresh_global_metrics_cache('dashboard');

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'global_metrics_cache_refresh_15m';

  perform cron.schedule(
    'global_metrics_cache_refresh_15m',
    '*/15 * * * *',
    $cron$select public.refresh_global_metrics_cache('dashboard');$cron$
  );
exception
  when undefined_table then
    null;
  when invalid_schema_name then
    null;
end;
$$;

commit;
