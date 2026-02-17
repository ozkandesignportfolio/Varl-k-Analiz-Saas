create or replace function public.calculate_next_due_date(
  base_date date,
  interval_value int,
  interval_unit text
)
returns date
language plpgsql
immutable
strict
as $$
begin
  if interval_value <= 0 then
    raise exception 'interval_value must be greater than 0';
  end if;

  if interval_unit = 'day' then
    return base_date + interval_value;
  end if;

  if interval_unit = 'week' then
    return base_date + (interval_value * 7);
  end if;

  if interval_unit = 'month' then
    return (base_date + make_interval(months => interval_value))::date;
  end if;

  if interval_unit = 'year' then
    return (base_date + make_interval(years => interval_value))::date;
  end if;

  raise exception 'invalid interval_unit: %', interval_unit;
end;
$$;

create or replace function public.validate_service_log_rule_link()
returns trigger
language plpgsql
as $$
declare
  linked_asset_id uuid;
  linked_user_id uuid;
begin
  if new.rule_id is null then
    return new;
  end if;

  select asset_id, user_id
  into linked_asset_id, linked_user_id
  from public.maintenance_rules
  where id = new.rule_id;

  if linked_asset_id is null then
    raise exception 'Selected maintenance rule was not found.';
  end if;

  if linked_asset_id <> new.asset_id then
    raise exception 'Selected maintenance rule does not belong to the selected asset.';
  end if;

  if linked_user_id <> new.user_id then
    raise exception 'Selected maintenance rule does not belong to the current user.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_service_log_validate_rule on public.service_logs;
create trigger trg_service_log_validate_rule
before insert or update on public.service_logs
for each row
execute function public.validate_service_log_rule_link();

create or replace function public.reset_rule_after_service_log()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is null then
    return new;
  end if;

  update public.maintenance_rules
  set
    last_service_date = new.service_date,
    next_due_date = public.calculate_next_due_date(
      new.service_date,
      interval_value,
      interval_unit
    )
  where
    id = new.rule_id
    and user_id = new.user_id
    and asset_id = new.asset_id;

  return new;
end;
$$;

drop trigger if exists trg_service_log_reset_rule_dates on public.service_logs;
create trigger trg_service_log_reset_rule_dates
after insert on public.service_logs
for each row
execute function public.reset_rule_after_service_log();
