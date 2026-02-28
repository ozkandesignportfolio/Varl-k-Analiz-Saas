-- Panel health RPC parity test
-- Purpose: validate compute_panel_health output semantics on a seeded dataset.
--
-- Usage:
-- 1) Run in Supabase SQL Editor.
-- 2) Requires at least one auth user.
-- 3) Data is rolled back at the end.

begin;

do $$
declare
  user_count int;
begin
  select count(*) into user_count from auth.users;
  if user_count < 1 then
    raise exception 'Panel health parity test requires at least 1 auth user.';
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
  v_payload jsonb;

  v_asset_1 uuid := gen_random_uuid();
  v_asset_2 uuid := gen_random_uuid();
  v_asset_3 uuid := gen_random_uuid();

  v_rule_1 uuid := gen_random_uuid();
  v_rule_2 uuid := gen_random_uuid();
  v_rule_3 uuid := gen_random_uuid();

  v_service_1 uuid := gen_random_uuid();
  v_service_2 uuid := gen_random_uuid();

  v_doc_1 uuid := gen_random_uuid();
  v_doc_2 uuid := gen_random_uuid();

  v_sub_1 uuid := gen_random_uuid();
  v_inv_1 uuid := gen_random_uuid();
  v_inv_2 uuid := gen_random_uuid();
  v_inv_3 uuid := gen_random_uuid();
  v_inv_4 uuid := gen_random_uuid();

  v_exp_1 uuid := gen_random_uuid();
  v_exp_2 uuid := gen_random_uuid();
  v_exp_3 uuid := gen_random_uuid();
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public.assets (id, user_id, name, category, created_at, updated_at, warranty_end_date)
  values
    (v_asset_1, v_user_id, 'A1', 'Machine', now(), now(), current_date + 10),
    (v_asset_2, v_user_id, 'A2', 'Machine', now(), now(), null),
    (v_asset_3, v_user_id, 'A3', 'Machine', now(), now(), current_date - 1);

  insert into public.maintenance_rules (
    id, asset_id, user_id, title, interval_value, interval_unit, last_service_date, next_due_date, is_active, created_at, updated_at
  )
  values
    (v_rule_1, v_asset_1, v_user_id, 'R1', 30, 'day', current_date - 1, current_date + 5, true, now(), now()),
    (v_rule_2, v_asset_2, v_user_id, 'R2', 30, 'day', null, current_date - 2, true, now(), now()),
    (v_rule_3, v_asset_3, v_user_id, 'R3', 30, 'day', null, current_date + 15, true, now(), now());

  insert into public.service_logs (
    id, asset_id, user_id, rule_id, service_type, service_date, cost, created_at
  )
  values
    (v_service_1, v_asset_1, v_user_id, v_rule_1, 'Oil', current_date - 1, 100, now()),
    (v_service_2, v_asset_2, v_user_id, v_rule_2, 'Check', current_date - 2, 50, now());

  insert into public.documents (
    id, asset_id, user_id, service_log_id, document_type, file_name, storage_path, file_size, uploaded_at
  )
  values
    (v_doc_1, v_asset_1, v_user_id, v_service_1, 'invoice', 'a1.pdf', v_user_id::text || '/' || v_asset_1::text || '/a1.pdf', 1000, now()),
    (v_doc_2, v_asset_2, v_user_id, v_service_2, 'invoice', 'a2.pdf', v_user_id::text || '/' || v_asset_2::text || '/a2.pdf', 1000, now());

  insert into public.billing_subscriptions (
    id, user_id, provider_name, subscription_name, billing_cycle, amount, currency, status
  )
  values
    (v_sub_1, v_user_id, 'Cloud', 'Pro', 'monthly', 100, 'TRY', 'active');

  insert into public.billing_invoices (
    id, user_id, subscription_id, invoice_no, issued_at, due_date, paid_at, amount, tax_amount, total_amount, status, created_at
  )
  values
    (v_inv_1, v_user_id, v_sub_1, 'I-1', current_date - 10, current_date - 5, current_date - 4, 100, 0, 100, 'paid', now()),
    (v_inv_2, v_user_id, v_sub_1, 'I-2', current_date - 9, current_date - 3, current_date - 2, 120, 0, 120, 'paid', now()),
    (v_inv_3, v_user_id, v_sub_1, 'I-3', current_date - 8, current_date + 3, null, 90, 0, 90, 'pending', now()),
    (v_inv_4, v_user_id, v_sub_1, 'I-4', current_date - 7, current_date - 1, null, 80, 0, 80, 'overdue', now());

  insert into public.expenses (id, user_id, asset_id, amount, category, note, created_at)
  values
    (v_exp_1, v_user_id, v_asset_1, 10000, 'satin alma', 'asset buy', now()),
    (v_exp_2, v_user_id, v_asset_2, 3000, 'misc', 'proxy', now()),
    (v_exp_3, v_user_id, null, 500, 'misc', 'general', now());

  select public.compute_panel_health(v_user_id) into v_payload;

  if (v_payload #>> '{score}')::int <> 20 then
    raise exception 'Parity FAIL: score expected 20, got %', v_payload #>> '{score}';
  end if;

  if round((v_payload #>> '{ratio}')::numeric, 3) <> 0.952 then
    raise exception 'Parity FAIL: ratio expected 0.952, got %', v_payload #>> '{ratio}';
  end if;

  if round((v_payload #>> '{assetPrice}')::numeric, 2) <> 13000.00 then
    raise exception 'Parity FAIL: assetPrice expected 13000.00, got %', v_payload #>> '{assetPrice}';
  end if;

  if round((v_payload #>> '{totalCost}')::numeric, 2) <> 13650.00 then
    raise exception 'Parity FAIL: totalCost expected 13650.00, got %', v_payload #>> '{totalCost}';
  end if;

  if (v_payload #>> '{warranty,score}')::int <> 40 then
    raise exception 'Parity FAIL: warranty.score expected 40, got %', v_payload #>> '{warranty,score}';
  end if;

  if (v_payload #>> '{maintenance,score}')::int <> 47 then
    raise exception 'Parity FAIL: maintenance.score expected 47, got %', v_payload #>> '{maintenance,score}';
  end if;

  if (v_payload #>> '{documents,score}')::int <> 67 then
    raise exception 'Parity FAIL: documents.score expected 67, got %', v_payload #>> '{documents,score}';
  end if;

  if (v_payload #>> '{payments,score}')::int <> 63 then
    raise exception 'Parity FAIL: payments.score expected 63, got %', v_payload #>> '{payments,score}';
  end if;

  if (v_payload #>> '{payments,total}')::int <> 4 then
    raise exception 'Parity FAIL: payments.total expected 4, got %', v_payload #>> '{payments,total}';
  end if;

  raise notice 'Panel health RPC parity test passed.';
end $$;

rollback;
