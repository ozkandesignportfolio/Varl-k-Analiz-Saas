begin;

create or replace function public.compute_panel_health(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
with
  assets_stats as (
    select
      count(*)::int as total_assets,
      count(*) filter (
        where warranty_end_date is null
      )::int as warranty_unknown,
      count(*) filter (
        where warranty_end_date is not null
          and warranty_end_date > (current_date + 30)
      )::int as warranty_active,
      count(*) filter (
        where warranty_end_date is not null
          and warranty_end_date >= current_date
          and warranty_end_date <= (current_date + 30)
      )::int as warranty_expiring,
      count(*) filter (
        where warranty_end_date is not null
          and warranty_end_date < current_date
      )::int as warranty_expired
    from public.assets
    where user_id = p_user_id
  ),
  maintenance_stats as (
    select
      count(*) filter (where is_active)::int as maintenance_planned,
      count(*) filter (
        where is_active and last_service_date is not null
      )::int as maintenance_completed,
      count(*) filter (
        where is_active and next_due_date >= current_date
      )::int as maintenance_on_track
    from public.maintenance_rules
    where user_id = p_user_id
  ),
  service_cost_stats as (
    select coalesce(sum(cost), 0)::numeric as maintenance_cost
    from public.service_logs
    where user_id = p_user_id
  ),
  documents_stats as (
    select count(distinct asset_id)::int as uploaded_assets
    from public.documents
    where user_id = p_user_id
      and asset_id is not null
  ),
  expenses_scoped as (
    select
      asset_id,
      coalesce(amount, 0)::numeric as amount,
      lower(
        coalesce(category, '')
        || ' '
        || coalesce(note, '')
      ) as search_text
    from public.expenses
    where user_id = p_user_id
      and coalesce(amount, 0) > 0
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
  ),
  expenses_stats as (
    select
      coalesce((select sum(amount) from expenses_scoped), 0)::numeric as expense_cost,
      coalesce((select sum(derived_asset_price) from expenses_per_asset), 0)::numeric as asset_price
  ),
  invoice_stats as (
    select
      count(*) filter (where status = 'paid')::int as paid_count,
      count(*) filter (where status = 'pending')::int as pending_count,
      count(*) filter (where status = 'overdue')::int as overdue_count
    from public.billing_invoices
    where user_id = p_user_id
  ),
  base as (
    select
      greatest(0, e.asset_price)::numeric as asset_price,
      greatest(0, s.maintenance_cost)::numeric as maintenance_cost,
      greatest(0, e.expense_cost)::numeric as expense_cost,
      a.total_assets,
      a.warranty_active,
      a.warranty_expiring,
      a.warranty_expired,
      a.warranty_unknown,
      m.maintenance_planned,
      m.maintenance_completed,
      m.maintenance_on_track,
      d.uploaded_assets,
      i.paid_count,
      i.pending_count,
      i.overdue_count
    from assets_stats a
    cross join maintenance_stats m
    cross join service_cost_stats s
    cross join documents_stats d
    cross join expenses_stats e
    cross join invoice_stats i
  ),
  calc as (
    select
      b.*,
      (b.maintenance_cost + b.expense_cost)::numeric as total_cost,
      case
        when (b.maintenance_cost + b.expense_cost) <= 0 then 0::numeric
        else (b.asset_price / nullif((b.maintenance_cost + b.expense_cost), 0))
      end as ratio,
      (b.maintenance_cost + b.expense_cost) <= 0 as has_no_cost,
      case
        when b.total_assets <= 0 then 100::numeric
        else (
          b.warranty_active * 100.0
          + b.warranty_expiring * 60.0
          + b.warranty_expired * 20.0
          + b.warranty_unknown * 40.0
        ) / b.total_assets
      end as warranty_score_raw,
      greatest(0, (b.maintenance_planned - b.maintenance_on_track))::int as maintenance_overdue,
      case
        when b.maintenance_planned > 0 then
          ((b.maintenance_completed::numeric / b.maintenance_planned) * 100 * 0.6)
          + ((b.maintenance_on_track::numeric / b.maintenance_planned) * 100 * 0.4)
        else 100::numeric
      end as maintenance_score_raw,
      case
        when b.total_assets > 0 then (b.uploaded_assets::numeric / b.total_assets) * 100
        else 100::numeric
      end as document_score_raw,
      greatest(0, (b.total_assets - b.uploaded_assets))::int as missing_documents,
      greatest(0, b.paid_count + b.pending_count + b.overdue_count)::int as payment_total,
      case
        when (b.paid_count + b.pending_count + b.overdue_count) > 0 then
          (
            (b.paid_count * 100.0)
            + (b.pending_count * 50.0)
          ) / (b.paid_count + b.pending_count + b.overdue_count)
        else 100::numeric
      end as payment_score_raw
    from base b
  )
select jsonb_build_object(
  'score',
  case
    when c.has_no_cost then 100
    when c.ratio < 1 then 20
    when c.ratio <= 2 then 40
    when c.ratio <= 4 then 60
    when c.ratio <= 8 then 80
    else 95
  end,
  'ratio',
  c.ratio,
  'hasNoCost',
  c.has_no_cost,
  'assetPrice',
  c.asset_price,
  'totalCost',
  c.total_cost,
  'maintenanceCost',
  c.maintenance_cost,
  'expenseCost',
  c.expense_cost,
  'warranty',
  jsonb_build_object(
    'score', least(100, greatest(0, round(c.warranty_score_raw)::int)),
    'active', case
      when c.total_assets > 0 then least(100, greatest(0, round((c.warranty_active::numeric / c.total_assets) * 100)::int))
      else 100
    end,
    'expiring', case
      when c.total_assets > 0 then least(100, greatest(0, round((c.warranty_expiring::numeric / c.total_assets) * 100)::int))
      else 0
    end,
    'expired', case
      when c.total_assets > 0 then least(100, greatest(0, round((c.warranty_expired::numeric / c.total_assets) * 100)::int))
      else 0
    end,
    'unknown', case
      when c.total_assets > 0 then least(100, greatest(0, round((c.warranty_unknown::numeric / c.total_assets) * 100)::int))
      else 0
    end
  ),
  'maintenance',
  jsonb_build_object(
    'score', least(100, greatest(0, round(c.maintenance_score_raw)::int)),
    'planned', c.maintenance_planned,
    'completed', c.maintenance_completed,
    'onTrack', c.maintenance_on_track,
    'overdue', c.maintenance_overdue
  ),
  'documents',
  jsonb_build_object(
    'score', least(100, greatest(0, round(c.document_score_raw)::int)),
    'required', c.total_assets,
    'uploaded', c.uploaded_assets,
    'missing', c.missing_documents
  ),
  'payments',
  jsonb_build_object(
    'score', least(100, greatest(0, round(c.payment_score_raw)::int)),
    'paid', c.paid_count,
    'pending', c.pending_count,
    'overdue', c.overdue_count,
    'total', c.payment_total
  ),
  'scope',
  'user',
  'warning',
  null,
  'generatedAt',
  now()
)
from calc c;
$$;

commit;
