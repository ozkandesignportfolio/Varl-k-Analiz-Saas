-- Dashboard snapshot parity test
-- Amac: get_dashboard_snapshot RPC sonucunun onceki dashboard JS mantigi ile uyumlu oldugunu
-- seeded bir veri setinde dogrulamak.
--
-- Kullanim:
-- 1) Supabase SQL Editor'de calistirin.
-- 2) En az bir auth kullanicisi olmali.
-- 3) Test verisi transaction sonunda rollback edilir.

begin;

do $$
declare
  user_count int;
begin
  select count(*) into user_count from auth.users;
  if user_count < 1 then
    raise exception 'Dashboard parity testi icin en az 1 auth kullanicisi gerekir.';
  end if;
end $$;

select set_config(
  'qa.user_id',
  (select id::text from auth.users order by created_at asc limit 1),
  true
);

set local role authenticated;

do $$
declare
  v_user_id uuid := current_setting('qa.user_id')::uuid;
  v_snapshot jsonb;

  v_asset_1 uuid := gen_random_uuid();
  v_asset_2 uuid := gen_random_uuid();
  v_rule_1 uuid := gen_random_uuid();
  v_rule_2 uuid := gen_random_uuid();
  v_service_1 uuid := gen_random_uuid();
  v_service_2 uuid := gen_random_uuid();
  v_document_1 uuid := gen_random_uuid();
  v_subscription_1 uuid := gen_random_uuid();
  v_invoice_1 uuid := gen_random_uuid();
  v_invoice_2 uuid := gen_random_uuid();
  v_invoice_3 uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.assets (id, user_id, name, category, created_at, updated_at, warranty_end_date)
  values
    (v_asset_1, v_user_id, 'Generator', 'Machine', '2026-01-01T09:00:00Z', '2026-02-09T12:00:00Z', '2026-02-16'),
    (v_asset_2, v_user_id, 'Pump', 'Machine', '2026-01-20T09:00:00Z', '2026-02-08T12:00:00Z', null);

  insert into public.maintenance_rules (
    id, asset_id, user_id, title, interval_value, interval_unit, next_due_date, is_active, created_at, updated_at
  )
  values
    (v_rule_1, v_asset_1, v_user_id, 'Oil change', 30, 'day', '2026-02-08', true, '2026-01-15T10:00:00Z', '2026-01-15T10:00:00Z'),
    (v_rule_2, v_asset_2, v_user_id, 'Pressure check', 30, 'day', '2026-02-13', true, '2026-02-01T10:00:00Z', '2026-02-01T10:00:00Z');

  insert into public.service_logs (
    id, asset_id, user_id, rule_id, service_type, service_date, cost, created_at
  )
  values
    (v_service_1, v_asset_1, v_user_id, v_rule_1, 'Oil', '2026-02-09', 100, '2026-02-09T10:00:00Z'),
    (v_service_2, v_asset_2, v_user_id, v_rule_2, 'Inspection', '2026-01-25', 50, '2026-02-05T10:00:00Z');

  insert into public.documents (
    id, asset_id, user_id, service_log_id, document_type, file_name, storage_path, file_size, uploaded_at
  )
  values
    (
      v_document_1,
      v_asset_1,
      v_user_id,
      v_service_1,
      'invoice',
      'invoice.pdf',
      v_user_id::text || '/' || v_asset_1::text || '/invoice.pdf',
      1024,
      '2026-02-09T12:00:00Z'
    );

  insert into public.billing_subscriptions (
    id, user_id, provider_name, subscription_name, billing_cycle, amount, currency, status
  )
  values
    (v_subscription_1, v_user_id, 'Cloud', 'Premium', 'monthly', 100, 'TRY', 'active');

  insert into public.billing_invoices (
    id, user_id, subscription_id, invoice_no, issued_at, due_date, paid_at, amount, tax_amount, total_amount, status, created_at
  )
  values
    (v_invoice_1, v_user_id, v_subscription_1, 'F-100', '2026-02-02', '2026-02-12', null, 200, 0, 200, 'pending', '2026-02-02T10:00:00Z'),
    (v_invoice_2, v_user_id, v_subscription_1, 'F-101', '2026-02-01', '2026-02-09', null, 300, 0, 300, 'overdue', '2026-02-01T10:00:00Z'),
    (v_invoice_3, v_user_id, v_subscription_1, 'F-102', '2026-02-03', '2026-02-05', '2026-02-09', 250, 0, 250, 'paid', '2026-02-03T10:00:00Z');

  select public.get_dashboard_snapshot(
    v_user_id,
    '2026-01-12T00:00:00Z'::timestamptz,
    '2026-02-11T00:00:00Z'::timestamptz
  ) into v_snapshot;

  if (v_snapshot #>> '{counts,assets_count}')::int <> 2 then
    raise exception 'Parity FAIL: assets_count beklenen 2, gelen %', v_snapshot #>> '{counts,assets_count}';
  end if;

  if (v_snapshot #>> '{counts,documents_count}')::int <> 1 then
    raise exception 'Parity FAIL: documents_count beklenen 1, gelen %', v_snapshot #>> '{counts,documents_count}';
  end if;

  if (v_snapshot #>> '{counts,subscriptions_count}')::int <> 1 then
    raise exception 'Parity FAIL: subscriptions_count beklenen 1, gelen %', v_snapshot #>> '{counts,subscriptions_count}';
  end if;

  if (v_snapshot #>> '{counts,invoices_count}')::int <> 3 then
    raise exception 'Parity FAIL: invoices_count beklenen 3, gelen %', v_snapshot #>> '{counts,invoices_count}';
  end if;

  if round((v_snapshot #>> '{sums,total_cost}')::numeric, 2) <> 150.00 then
    raise exception 'Parity FAIL: total_cost beklenen 150.00, gelen %', v_snapshot #>> '{sums,total_cost}';
  end if;

  if round((v_snapshot #>> '{sums,documents_total_size}')::numeric, 2) <> 1024.00 then
    raise exception 'Parity FAIL: documents_total_size beklenen 1024, gelen %', v_snapshot #>> '{sums,documents_total_size}';
  end if;

  if round((v_snapshot #>> '{sums,invoices_total_amount}')::numeric, 2) <> 750.00 then
    raise exception 'Parity FAIL: invoices_total_amount beklenen 750.00, gelen %', v_snapshot #>> '{sums,invoices_total_amount}';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{risk_panel,overdue_maintenance}'), 0) <> 1 then
    raise exception 'Parity FAIL: overdue_maintenance beklenen 1.';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{risk_panel,upcoming_maintenance}'), 0) <> 1 then
    raise exception 'Parity FAIL: upcoming_maintenance beklenen 1.';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{risk_panel,upcoming_warranty}'), 0) <> 1 then
    raise exception 'Parity FAIL: upcoming_warranty beklenen 1.';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{risk_panel,upcoming_payments}'), 0) <> 2 then
    raise exception 'Parity FAIL: upcoming_payments beklenen 2.';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{risk_panel,missing_documents}'), 0) <> 1 then
    raise exception 'Parity FAIL: missing_documents beklenen 1.';
  end if;

  if coalesce(jsonb_array_length(v_snapshot #> '{timeline}'), 0) <> 6 then
    raise exception 'Parity FAIL: timeline beklenen 6.';
  end if;

  if (v_snapshot #>> '{status,tone}') <> 'critical' then
    raise exception 'Parity FAIL: status.tone beklenen critical, gelen %', v_snapshot #>> '{status,tone}';
  end if;

  if (v_snapshot #>> '{status,headline}') <> '1 gecikmis bakim' then
    raise exception 'Parity FAIL: status.headline beklenen "1 gecikmis bakim", gelen %', v_snapshot #>> '{status,headline}';
  end if;

  if (v_snapshot #>> '{trends,total_assets,direction}') <> 'flat' then
    raise exception 'Parity FAIL: trends.total_assets.direction beklenen flat, gelen %', v_snapshot #>> '{trends,total_assets,direction}';
  end if;

  if (v_snapshot #>> '{trends,total_service_cost,direction}') <> 'up' then
    raise exception 'Parity FAIL: trends.total_service_cost.direction beklenen up, gelen %', v_snapshot #>> '{trends,total_service_cost,direction}';
  end if;

  raise notice 'Dashboard snapshot parity testi basariyla gecti.';
end $$;

rollback;
