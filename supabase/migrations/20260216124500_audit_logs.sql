create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('assets', 'maintenance_rules', 'service_logs', 'documents')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_fields text[] not null default '{}',
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_user_created on public.audit_logs(user_id, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(user_id, entity_type, entity_id, created_at desc);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_own" on public.audit_logs;
create policy "audit_logs_select_own" on public.audit_logs
for select
using (auth.uid() = user_id or auth.role() = 'service_role');

drop policy if exists "audit_logs_insert_own" on public.audit_logs;
create policy "audit_logs_insert_own" on public.audit_logs
for insert
with check (auth.uid() = user_id or auth.role() = 'service_role');

create or replace function public.create_audit_log_for_entity()
returns trigger
language plpgsql
as $$
declare
  before_data jsonb;
  after_data jsonb;
  old_values jsonb := '{}'::jsonb;
  new_values jsonb := '{}'::jsonb;
  changed_fields text[] := '{}'::text[];
  field_name text;
  entity_id uuid;
  actor_id uuid;
  target_user_id uuid;
begin
  if tg_op = 'INSERT' then
    after_data := to_jsonb(new) - array['updated_at'];
    changed_fields := coalesce(
      array(
        select jsonb_object_keys(after_data)
        order by 1
      ),
      '{}'::text[]
    );
    new_values := after_data;
    entity_id := new.id;
    target_user_id := new.user_id;
  elsif tg_op = 'DELETE' then
    before_data := to_jsonb(old) - array['updated_at'];
    changed_fields := coalesce(
      array(
        select jsonb_object_keys(before_data)
        order by 1
      ),
      '{}'::text[]
    );
    old_values := before_data;
    entity_id := old.id;
    target_user_id := old.user_id;
  else
    before_data := to_jsonb(old) - array['updated_at'];
    after_data := to_jsonb(new) - array['updated_at'];
    entity_id := new.id;
    target_user_id := coalesce(new.user_id, old.user_id);

    for field_name in
      select key
      from (
        select jsonb_object_keys(before_data || after_data) as key
      ) keys
      order by key
    loop
      if (before_data -> field_name) is distinct from (after_data -> field_name) then
        changed_fields := array_append(changed_fields, field_name);
        old_values := jsonb_set(
          old_values,
          array[field_name],
          coalesce(before_data -> field_name, 'null'::jsonb),
          true
        );
        new_values := jsonb_set(
          new_values,
          array[field_name],
          coalesce(after_data -> field_name, 'null'::jsonb),
          true
        );
      end if;
    end loop;

    if array_length(changed_fields, 1) is null then
      return new;
    end if;
  end if;

  actor_id := coalesce(auth.uid(), target_user_id);

  insert into public.audit_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    changed_fields,
    old_values,
    new_values
  ) values (
    actor_id,
    tg_table_name,
    entity_id,
    lower(tg_op),
    changed_fields,
    nullif(old_values, '{}'::jsonb),
    nullif(new_values, '{}'::jsonb)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_assets_audit_log on public.assets;
create trigger trg_assets_audit_log
after insert or update or delete on public.assets
for each row
execute function public.create_audit_log_for_entity();

drop trigger if exists trg_maintenance_rules_audit_log on public.maintenance_rules;
create trigger trg_maintenance_rules_audit_log
after insert or update or delete on public.maintenance_rules
for each row
execute function public.create_audit_log_for_entity();

drop trigger if exists trg_service_logs_audit_log on public.service_logs;
create trigger trg_service_logs_audit_log
after insert or update or delete on public.service_logs
for each row
execute function public.create_audit_log_for_entity();

drop trigger if exists trg_documents_audit_log on public.documents;
create trigger trg_documents_audit_log
after insert or update or delete on public.documents
for each row
execute function public.create_audit_log_for_entity();
