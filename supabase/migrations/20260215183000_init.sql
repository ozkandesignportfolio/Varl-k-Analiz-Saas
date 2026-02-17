create extension if not exists pgcrypto;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  brand text,
  model text,
  purchase_date date,
  warranty_end_date date,
  serial_number text,
  notes text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  interval_value int not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('day', 'week', 'month', 'year')),
  last_service_date date,
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.maintenance_rules(id) on delete set null,
  service_type text not null,
  service_date date not null,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  provider text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_log_id uuid references public.service_logs(id) on delete set null,
  document_type text not null,
  file_name text not null,
  storage_path text not null unique,
  file_size bigint,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_assets_user_id on public.assets(user_id);
create index if not exists idx_assets_warranty_end on public.assets(user_id, warranty_end_date);
create index if not exists idx_rules_due on public.maintenance_rules(user_id, next_due_date) where is_active = true;
create index if not exists idx_service_logs_date on public.service_logs(user_id, service_date desc);
create index if not exists idx_documents_uploaded on public.documents(user_id, uploaded_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assets_updated_at on public.assets;
create trigger trg_assets_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

drop trigger if exists trg_rules_updated_at on public.maintenance_rules;
create trigger trg_rules_updated_at
before update on public.maintenance_rules
for each row
execute function public.set_updated_at();

alter table public.assets enable row level security;
alter table public.maintenance_rules enable row level security;
alter table public.service_logs enable row level security;
alter table public.documents enable row level security;

drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own" on public.assets
for select using (auth.uid() = user_id);

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own" on public.assets
for insert with check (auth.uid() = user_id);

drop policy if exists "assets_update_own" on public.assets;
create policy "assets_update_own" on public.assets
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "assets_delete_own" on public.assets;
create policy "assets_delete_own" on public.assets
for delete using (auth.uid() = user_id);

drop policy if exists "rules_select_own" on public.maintenance_rules;
create policy "rules_select_own" on public.maintenance_rules
for select using (auth.uid() = user_id);

drop policy if exists "rules_insert_own" on public.maintenance_rules;
create policy "rules_insert_own" on public.maintenance_rules
for insert with check (auth.uid() = user_id);

drop policy if exists "rules_update_own" on public.maintenance_rules;
create policy "rules_update_own" on public.maintenance_rules
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "rules_delete_own" on public.maintenance_rules;
create policy "rules_delete_own" on public.maintenance_rules
for delete using (auth.uid() = user_id);

drop policy if exists "service_logs_select_own" on public.service_logs;
create policy "service_logs_select_own" on public.service_logs
for select using (auth.uid() = user_id);

drop policy if exists "service_logs_insert_own" on public.service_logs;
create policy "service_logs_insert_own" on public.service_logs
for insert with check (auth.uid() = user_id);

drop policy if exists "service_logs_update_own" on public.service_logs;
create policy "service_logs_update_own" on public.service_logs
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "service_logs_delete_own" on public.service_logs;
create policy "service_logs_delete_own" on public.service_logs
for delete using (auth.uid() = user_id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
for select using (auth.uid() = user_id);

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
for insert with check (auth.uid() = user_id);

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
for delete using (auth.uid() = user_id);

