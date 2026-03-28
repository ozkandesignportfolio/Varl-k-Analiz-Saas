-- RLS Negatif Testleri
-- Tarih: 2026-02-16
-- Amaç: Tenant izolasyonunun cross-user erişime izin vermediğini doğrulamak.
--
-- Kullanım:
-- 1) Supabase SQL Editor'de çalıştırın.
-- 2) En az 2 farklı auth kullanıcısı olmalıdır.
-- 3) Script test verisi üretir ve ROLLBACK ile geri alır.

begin;

-- Ön koşul: en az iki kullanıcı.
do $$
declare
  user_count int;
begin
  select count(*) into user_count from auth.users;
  if user_count < 2 then
    raise exception 'RLS negatif testi için en az 2 auth kullanıcısı gerekir.';
  end if;
end $$;

select set_config(
  'qa.user_a',
  (select id::text from auth.users order by created_at asc limit 1),
  true
);

select set_config(
  'qa.user_b',
  (select id::text from auth.users where id::text <> current_setting('qa.user_a') order by created_at asc limit 1),
  true
);

set local role authenticated;

do $$
declare
  user_a uuid := current_setting('qa.user_a')::uuid;
  user_b uuid := current_setting('qa.user_b')::uuid;

  asset_a uuid := gen_random_uuid();
  rule_a uuid := gen_random_uuid();
  service_a uuid := gen_random_uuid();
  document_a uuid := gen_random_uuid();
  sub_a uuid := gen_random_uuid();
  invoice_a uuid := gen_random_uuid();

  visible_count int;
  affected int;
begin
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', user_a::text, true);

  insert into public.assets (id, user_id, name, category)
  values (asset_a, user_a, 'RLS Test Varlık A', 'Test');

  insert into public.maintenance_rules (
    id, asset_id, user_id, title, interval_value, interval_unit, next_due_date
  ) values (
    rule_a, asset_a, user_a, 'RLS Test Kural A', 30, 'day', current_date + 30
  );

  insert into public.service_logs (
    id, asset_id, user_id, rule_id, service_type, service_date, cost
  ) values (
    service_a, asset_a, user_a, rule_a, 'RLS Test Servis A', current_date, 0
  );

  insert into public.documents (
    id, asset_id, user_id, service_log_id, document_type, file_name, storage_path
  ) values (
    document_a,
    asset_a,
    user_a,
    service_a,
    'diger',
    'rls-test.pdf',
    user_a::text || '/' || asset_a::text || '/rls-test.pdf'
  );

  insert into public.billing_subscriptions (
    id, user_id, provider_name, subscription_name, billing_cycle, amount, currency, status
  ) values (
    sub_a, user_a, 'RLS Test', 'RLS Plan', 'monthly', 99, 'TRY', 'active'
  );

  insert into public.billing_invoices (
    id, user_id, subscription_id, issued_at, amount, tax_amount, total_amount, status
  ) values (
    invoice_a, user_a, sub_a, current_date, 99, 18, 117, 'pending'
  );

  perform set_config('request.jwt.claim.sub', user_b::text, true);

  -- SELECT izolasyonu
  select count(*) into visible_count from public.assets where id = asset_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b assets kaydını görebildi.';
  end if;

  select count(*) into visible_count from public.maintenance_rules where id = rule_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b maintenance_rules kaydını görebildi.';
  end if;

  select count(*) into visible_count from public.service_logs where id = service_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b service_logs kaydını görebildi.';
  end if;

  select count(*) into visible_count from public.documents where id = document_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b documents kaydını görebildi.';
  end if;

  select count(*) into visible_count from public.billing_subscriptions where id = sub_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b billing_subscriptions kaydını görebildi.';
  end if;

  select count(*) into visible_count from public.billing_invoices where id = invoice_a;
  if visible_count <> 0 then
    raise exception 'RLS FAIL: user_b billing_invoices kaydını görebildi.';
  end if;

  -- UPDATE/DELETE izolasyonu
  update public.assets set name = 'RLS İhlal' where id = asset_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: user_b assets kaydını güncelleyebildi.';
  end if;

  delete from public.assets where id = asset_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: user_b assets kaydını silebildi.';
  end if;

  update public.billing_subscriptions set plan_name = 'RLS İhlal' where id = sub_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: user_b billing_subscriptions kaydını güncelleyebildi.';
  end if;

  delete from public.billing_invoices where id = invoice_a;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'RLS FAIL: user_b billing_invoices kaydını silebildi.';
  end if;

  -- WITH CHECK izolasyonu: user_b, user_a adına insert atamaz.
  begin
    insert into public.assets (user_id, name, category)
    values (user_a, 'RLS İhlal Insert', 'Test');
    raise exception 'RLS FAIL: user_b user_a adına assets insert atabildi.';
  exception
    when others then
      if position('row-level security' in lower(sqlerrm)) = 0 then
        raise exception 'Beklenen RLS hatası alınamadı. Alınan hata: %', sqlerrm;
      end if;
  end;

  raise notice 'RLS negatif testleri başarıyla geçti.';
end $$;

rollback;
