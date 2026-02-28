begin;

create table if not exists public.api_rate_limit_tokens (
  scope text not null,
  subject text not null,
  tokens numeric(12, 4) not null,
  last_refill_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_rate_limit_tokens_pkey primary key (scope, subject)
);

create index if not exists api_rate_limit_tokens_expires_at_idx
  on public.api_rate_limit_tokens (expires_at);

alter table public.api_rate_limit_tokens enable row level security;

revoke all on table public.api_rate_limit_tokens from anon, authenticated;
grant all on table public.api_rate_limit_tokens to service_role;

create or replace function public.take_api_rate_limit_token(
  p_scope text,
  p_subject text,
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_capacity integer := greatest(1, coalesce(p_capacity, 1));
  v_refill_per_sec numeric := greatest(0.0001, coalesce(p_refill_per_sec, 1));
  v_cost integer := greatest(1, coalesce(p_cost, 1));
  v_ttl_seconds integer := greatest(5, coalesce(p_ttl_seconds, 180));
  v_tokens numeric := 0;
  v_last_refill_at timestamptz := v_now;
  v_refilled_tokens numeric := 0;
  v_remaining numeric := 0;
  v_retry_seconds numeric := 0;
begin
  delete from public.api_rate_limit_tokens
  where scope = p_scope
    and subject = p_subject
    and expires_at <= v_now;

  loop
    select tokens, last_refill_at
      into v_tokens, v_last_refill_at
    from public.api_rate_limit_tokens
    where scope = p_scope
      and subject = p_subject
    for update;

    if not found then
      v_refilled_tokens := v_capacity;
      if v_refilled_tokens >= v_cost then
        v_remaining := v_refilled_tokens - v_cost;
        begin
          insert into public.api_rate_limit_tokens (
            scope,
            subject,
            tokens,
            last_refill_at,
            expires_at,
            updated_at
          )
          values (
            p_scope,
            p_subject,
            v_remaining,
            v_now,
            v_now + make_interval(secs => v_ttl_seconds),
            v_now
          );

          return query select true, floor(v_remaining)::integer, 0;
          return;
        exception
          when unique_violation then
            null;
        end;
      else
        return query select false, 0, 60000;
        return;
      end if;
    else
      v_refilled_tokens := least(
        v_capacity::numeric,
        greatest(0, coalesce(v_tokens, 0))
          + (extract(epoch from (v_now - coalesce(v_last_refill_at, v_now))) * v_refill_per_sec)
      );

      if v_refilled_tokens >= v_cost then
        v_remaining := v_refilled_tokens - v_cost;
        update public.api_rate_limit_tokens
        set tokens = v_remaining,
            last_refill_at = v_now,
            expires_at = v_now + make_interval(secs => v_ttl_seconds),
            updated_at = v_now
        where scope = p_scope
          and subject = p_subject;

        return query select true, floor(v_remaining)::integer, 0;
        return;
      end if;

      v_retry_seconds := (v_cost - v_refilled_tokens) / v_refill_per_sec;

      update public.api_rate_limit_tokens
      set tokens = v_refilled_tokens,
          last_refill_at = v_now,
          expires_at = v_now + make_interval(secs => v_ttl_seconds),
          updated_at = v_now
      where scope = p_scope
        and subject = p_subject;

      return query select false, floor(greatest(0, v_refilled_tokens))::integer, ceil(greatest(0, v_retry_seconds) * 1000)::integer;
      return;
    end if;
  end loop;
end;
$$;

grant execute on function public.take_api_rate_limit_token(text, text, integer, numeric, integer, integer)
  to authenticated, service_role;

commit;
