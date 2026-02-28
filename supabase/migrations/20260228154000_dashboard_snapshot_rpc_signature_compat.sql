begin;

-- Compatibility overload for PostgREST schema-cache lookups that resolve
-- arguments in (p_from, p_to, p_user_id) order.
create or replace function public.get_dashboard_snapshot(
  p_from timestamptz,
  p_to timestamptz,
  p_user_id uuid
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select public.get_dashboard_snapshot(p_user_id, p_from, p_to);
$$;

commit;
