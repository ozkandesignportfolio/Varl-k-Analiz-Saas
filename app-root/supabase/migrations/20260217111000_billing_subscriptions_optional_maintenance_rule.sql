-- Add optional maintenance rule link to billing subscriptions without rewriting existing table.

do $$
begin
  if to_regclass('public.billing_subscriptions') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'billing_subscriptions'
      and column_name = 'maintenance_rule_id'
  ) then
    alter table public.billing_subscriptions
      add column maintenance_rule_id uuid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.billing_subscriptions'::regclass
      and conname = 'billing_subscriptions_maintenance_rule_id_fkey'
  ) then
    alter table public.billing_subscriptions
      add constraint billing_subscriptions_maintenance_rule_id_fkey
      foreign key (maintenance_rule_id)
      references public.maintenance_rules(id)
      on delete set null;
  end if;
end;
$$;
