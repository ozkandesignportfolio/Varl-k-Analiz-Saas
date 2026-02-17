-- Run after bootstrap migration in Supabase SQL Editor

select to_regclass('public.assets') as assets_table;
select to_regclass('public.maintenance_rules') as maintenance_rules_table;
select to_regclass('public.service_logs') as service_logs_table;
select to_regclass('public.documents') as documents_table;
select to_regclass('public.subscription_requests') as subscription_requests_table;
select to_regclass('public.audit_logs') as audit_logs_table;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'assets'
  and column_name = 'qr_code';

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'assets'
  and indexname = 'idx_assets_qr_code';

select id, name, public
from storage.buckets
where id = 'documents-private';

select policyname, tablename
from pg_policies
where schemaname = 'public'
  and tablename in ('assets', 'maintenance_rules', 'service_logs', 'documents', 'subscription_requests', 'audit_logs')
order by tablename, policyname;

select policyname, tablename
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'documents_%'
order by policyname;
