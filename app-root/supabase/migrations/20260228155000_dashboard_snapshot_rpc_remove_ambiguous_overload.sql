begin;

-- PostgREST cannot disambiguate overloaded RPC functions that share
-- the same argument names with only different parameter order.
drop function if exists public.get_dashboard_snapshot(
  timestamptz,
  timestamptz,
  uuid
);

commit;
