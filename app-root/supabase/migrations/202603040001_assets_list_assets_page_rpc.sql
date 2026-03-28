begin;

drop function if exists public.list_assets_page(
  uuid,
  text,
  uuid,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.list_assets_page(
  p_user_id uuid,
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_page_size integer default 31,
  p_search text default null,
  p_category text default null,
  p_asset_filter text default null,
  p_warranty_filter text default null,
  p_maintenance_filter text default null,
  p_sort text default 'updated'
)
returns table(
  id uuid,
  name text,
  category text,
  serial_number text,
  brand text,
  model text,
  purchase_date date,
  warranty_end_date date,
  photo_path text,
  qr_code text,
  created_at timestamptz,
  updated_at timestamptz,
  next_maintenance_date date,
  last_service_date date,
  document_count integer,
  total_cost numeric,
  warranty_state text,
  maintenance_state text,
  asset_state text,
  score integer,
  cursor_value text
)
language sql
stable
set search_path = public
as $$
  with params as (
    select
      greatest(1, least(coalesce(p_page_size, 31), 101))::int as page_size,
      case
        when p_sort in ('updated', 'cost', 'score') then p_sort
        else 'updated'
      end::text as sort_mode,
      nullif(btrim(p_search), '')::text as search_term,
      nullif(btrim(p_category), '')::text as category_filter,
      nullif(btrim(p_asset_filter), '')::text as asset_filter,
      nullif(btrim(p_warranty_filter), '')::text as warranty_filter,
      nullif(btrim(p_maintenance_filter), '')::text as maintenance_filter
  ),
  base as (
    select
      a.id,
      a.name,
      a.category,
      a.serial_number,
      a.brand,
      a.model,
      a.purchase_date,
      a.warranty_end_date,
      a.photo_path,
      a.qr_code,
      a.created_at,
      a.updated_at,
      coalesce(d.document_count, 0)::int as document_count,
      coalesce(s.total_cost, 0)::numeric as total_cost,
      s.last_service_date,
      m.next_maintenance_date,
      case
        when a.warranty_end_date is null then 'active'
        when a.warranty_end_date < current_date then 'expired'
        when a.warranty_end_date <= (current_date + 45) then 'expiring'
        else 'active'
      end::text as warranty_state,
      case
        when m.next_maintenance_date is null then 'none'
        when m.next_maintenance_date < current_date then 'overdue'
        when m.next_maintenance_date <= (current_date + 14) then 'upcoming'
        else 'scheduled'
      end::text as maintenance_state
    from public.assets a
    cross join params p
    left join lateral (
      select
        coalesce(sum(sl.cost), 0)::numeric as total_cost,
        max(sl.service_date)::date as last_service_date
      from public.service_logs sl
      where sl.user_id = p_user_id
        and sl.asset_id = a.id
    ) s on true
    left join lateral (
      select count(*)::int as document_count
      from public.documents d
      where d.user_id = p_user_id
        and d.asset_id = a.id
    ) d on true
    left join lateral (
      select min(r.next_due_date)::date as next_maintenance_date
      from public.maintenance_rules r
      where r.user_id = p_user_id
        and r.asset_id = a.id
        and r.is_active = true
    ) m on true
    where a.user_id = p_user_id
      and (
        p.search_term is null
        or a.name ilike ('%' || p.search_term || '%')
        or coalesce(a.serial_number, '') ilike ('%' || p.search_term || '%')
      )
      and (p.category_filter is null or a.category = p.category_filter)
  ),
  scored as (
    select
      b.*,
      case when b.maintenance_state = 'overdue' then 'passive' else 'active' end::text as asset_state,
      greatest(
        0,
        least(
          100,
          100
          - case when b.warranty_state = 'expired' then 35 when b.warranty_state = 'expiring' then 15 else 0 end
          - case when b.maintenance_state = 'overdue' then 35 when b.maintenance_state = 'upcoming' then 15 else 0 end
          - case when b.document_count = 0 then 10 else 0 end
        )
      )::int as score
    from base b
  ),
  filtered as (
    select s.*, p.sort_mode
    from scored s
    cross join params p
    where (p.asset_filter is null or s.asset_state = p.asset_filter)
      and (p.warranty_filter is null or s.warranty_state = p.warranty_filter)
      and (p.maintenance_filter is null or s.maintenance_state = p.maintenance_filter)
  ),
  paged as (
    select
      f.id,
      f.name,
      f.category,
      f.serial_number,
      f.brand,
      f.model,
      f.purchase_date,
      f.warranty_end_date,
      f.photo_path,
      f.qr_code,
      f.created_at,
      f.updated_at,
      f.next_maintenance_date,
      f.last_service_date,
      f.document_count,
      f.total_cost,
      f.warranty_state,
      f.maintenance_state,
      f.asset_state,
      f.score,
      case
        when f.sort_mode = 'cost' then coalesce(f.total_cost, 0)::text
        when f.sort_mode = 'score' then coalesce(f.score, 0)::text
        else f.updated_at::text
      end::text as cursor_value,
      f.sort_mode
    from filtered f
    where
      p_cursor_id is null
      or (
        case
          when f.sort_mode = 'cost' then
            (coalesce(f.total_cost, 0), f.id) <
            (coalesce(nullif(p_cursor_value, ''), '0')::numeric, p_cursor_id)
          when f.sort_mode = 'score' then
            (coalesce(f.score, 0)::numeric, f.id) <
            (coalesce(nullif(p_cursor_value, ''), '0')::numeric, p_cursor_id)
          else
            (f.updated_at, f.id) <
            (coalesce(nullif(p_cursor_value, ''), '9999-12-31T23:59:59.999999+00')::timestamptz, p_cursor_id)
        end
      )
    order by
      case when f.sort_mode = 'cost' then coalesce(f.total_cost, 0) end desc,
      case when f.sort_mode = 'score' then coalesce(f.score, 0) end desc,
      case when f.sort_mode = 'updated' then f.updated_at end desc,
      f.id desc
    limit (select page_size from params)
  )
  select
    p.id,
    p.name,
    p.category,
    p.serial_number,
    p.brand,
    p.model,
    p.purchase_date,
    p.warranty_end_date,
    p.photo_path,
    p.qr_code,
    p.created_at,
    p.updated_at,
    p.next_maintenance_date,
    p.last_service_date,
    p.document_count,
    p.total_cost,
    p.warranty_state,
    p.maintenance_state,
    p.asset_state,
    p.score,
    p.cursor_value
  from paged p;
$$;

commit;
