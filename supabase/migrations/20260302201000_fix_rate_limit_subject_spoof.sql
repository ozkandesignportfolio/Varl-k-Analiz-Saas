begin;

do $$
begin
  if to_regprocedure('public.take_api_rate_limit_token_internal(text, text, integer, numeric, integer, integer)') is null then
    if to_regprocedure('public.take_api_rate_limit_token(text, text, integer, numeric, integer, integer)') is not null then
      alter function public.take_api_rate_limit_token(text, text, integer, numeric, integer, integer)
        rename to take_api_rate_limit_token_internal;
    end if;
  elsif to_regprocedure('public.take_api_rate_limit_token(text, text, integer, numeric, integer, integer)') is not null then
    drop function public.take_api_rate_limit_token(text, text, integer, numeric, integer, integer);
  end if;
end
$$;

create or replace function public.take_api_rate_limit_token(
  p_scope text,
  p_capacity integer,
  p_refill_per_sec numeric,
  p_cost integer default 1,
  p_ttl_seconds integer default 180
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_ms integer
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.take_api_rate_limit_token_internal(
    p_scope,
    auth.uid()::text,
    p_capacity,
    p_refill_per_sec,
    p_cost,
    p_ttl_seconds
  );
$$;

revoke all on function public.take_api_rate_limit_token(text, integer, numeric, integer, integer)
  from public, anon, service_role;
grant execute on function public.take_api_rate_limit_token(text, integer, numeric, integer, integer)
  to authenticated;

revoke all on function public.take_api_rate_limit_token_internal(text, text, integer, numeric, integer, integer)
  from public, anon, authenticated;
grant execute on function public.take_api_rate_limit_token_internal(text, text, integer, numeric, integer, integer)
  to service_role;

commit;
