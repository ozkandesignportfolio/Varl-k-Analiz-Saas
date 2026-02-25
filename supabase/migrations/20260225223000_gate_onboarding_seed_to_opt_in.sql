-- Seed onboarding demo data for newly created auth users.
-- This runs only for future signups and does not modify existing users.

create or replace function public.seed_onboarding_demo_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_id uuid;
  v_rule_id uuid;
  v_subscription_id uuid;
  v_today date := current_date;
begin
  -- Default-off guard: seed runs only when signup metadata explicitly opts in.
  if lower(coalesce(new.raw_user_meta_data ->> 'enable_onboarding_seed', 'false')) <> 'true' then
    return new;
  end if;

  if to_regclass('public.assets') is null then
    return new;
  end if;

  -- Guard against duplicate inserts if the trigger is recreated and re-fired manually.
  if exists (select 1 from public.assets where user_id = new.id) then
    return new;
  end if;

  insert into public.assets (
    user_id,
    name,
    category,
    brand,
    model,
    purchase_date,
    warranty_end_date,
    serial_number,
    notes
  )
  values (
    new.id,
    'Demo Kombi',
    'Isitma',
    'Bosch',
    'Condens 2200i',
    v_today - interval '18 months',
    v_today + interval '6 months',
    'AC-DEMO-001',
    'Onboarding demosi icin olusturulan ornek varlik.'
  )
  returning id into v_asset_id;

  if to_regclass('public.maintenance_rules') is not null then
    insert into public.maintenance_rules (
      asset_id,
      user_id,
      title,
      interval_value,
      interval_unit,
      last_service_date,
      next_due_date,
      is_active
    )
    values (
      v_asset_id,
      new.id,
      'Yillik kombi bakimi',
      12,
      'month',
      v_today - interval '11 months',
      v_today + interval '1 month',
      true
    )
    returning id into v_rule_id;
  end if;

  if to_regclass('public.service_logs') is not null then
    insert into public.service_logs (
      asset_id,
      user_id,
      rule_id,
      service_type,
      service_date,
      cost,
      provider,
      notes
    )
    values (
      v_asset_id,
      new.id,
      v_rule_id,
      'Periyodik Bakim',
      v_today - interval '30 days',
      1450,
      'Demo Teknik Servis',
      'Filtre temizligi ve genel kontrol tamamlandi.'
    );
  end if;

  if to_regclass('public.billing_subscriptions') is not null then
    insert into public.billing_subscriptions (
      user_id,
      maintenance_rule_id,
      provider_name,
      subscription_name,
      plan_name,
      billing_cycle,
      amount,
      currency,
      next_billing_date,
      auto_renew,
      status,
      notes
    )
    values (
      new.id,
      v_rule_id,
      'Demo Servis',
      'Yillik Bakim Paketi',
      'Standart',
      'yearly',
      3600,
      'TRY',
      v_today + interval '1 month',
      true,
      'active',
      'Onboarding icin ornek abonelik kaydi.'
    )
    returning id into v_subscription_id;
  end if;

  if v_subscription_id is not null and to_regclass('public.billing_invoices') is not null then
    insert into public.billing_invoices (
      user_id,
      subscription_id,
      invoice_no,
      period_start,
      period_end,
      issued_at,
      due_date,
      paid_at,
      amount,
      tax_amount,
      total_amount,
      status
    )
    values (
      new.id,
      v_subscription_id,
      concat('DEMO-', to_char(v_today, 'YYYYMM'), '-001'),
      v_today - interval '12 months',
      v_today,
      v_today - interval '3 days',
      v_today + interval '7 days',
      v_today - interval '1 day',
      3050,
      550,
      3600,
      'paid'
    );
  end if;

  return new;
exception
  when others then
    raise warning 'seed_onboarding_demo_data failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_seed_onboarding_demo_data on auth.users;
create trigger trg_seed_onboarding_demo_data
after insert on auth.users
for each row
execute function public.seed_onboarding_demo_data();
