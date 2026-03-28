SELECT 1;
-- Repair migration: ensures billing tables/policies exist even when previous migration was not applied.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null,
  subscription_name text not null,
  plan_name text,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'TRY',
  next_billing_date date,
  auto_renew boolean not null default true,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_subscriptions_user_created
  on public.billing_subscriptions(user_id, created_at desc);

create index if not exists idx_billing_subscriptions_user_next_billing
  on public.billing_subscriptions(user_id, next_billing_date)
  where status = 'active';

alter table public.billing_subscriptions enable row level security;

drop policy if exists "billing_subscriptions_select_own" on public.billing_subscriptions;
create policy "billing_subscriptions_select_own"
on public.billing_subscriptions
for select using (auth.uid() = user_id);

drop policy if exists "billing_subscriptions_insert_own" on public.billing_subscriptions;
create policy "billing_subscriptions_insert_own"
on public.billing_subscriptions
for insert with check (auth.uid() = user_id);

drop policy if exists "billing_subscriptions_update_own" on public.billing_subscriptions;
create policy "billing_subscriptions_update_own"
on public.billing_subscriptions
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "billing_subscriptions_delete_own" on public.billing_subscriptions;
create policy "billing_subscriptions_delete_own"
on public.billing_subscriptions
for delete using (auth.uid() = user_id);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.billing_subscriptions(id) on delete cascade,
  invoice_no text,
  period_start date,
  period_end date,
  issued_at date not null default current_date,
  due_date date,
  paid_at date,
  amount numeric(12,2) not null check (amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  file_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_invoices_user_created
  on public.billing_invoices(user_id, created_at desc);

create index if not exists idx_billing_invoices_user_due
  on public.billing_invoices(user_id, due_date, status);

create index if not exists idx_billing_invoices_subscription
  on public.billing_invoices(subscription_id, issued_at desc);

alter table public.billing_invoices enable row level security;

drop policy if exists "billing_invoices_select_own" on public.billing_invoices;
create policy "billing_invoices_select_own"
on public.billing_invoices
for select using (auth.uid() = user_id);

drop policy if exists "billing_invoices_insert_own" on public.billing_invoices;
create policy "billing_invoices_insert_own"
on public.billing_invoices
for insert with check (auth.uid() = user_id);

drop policy if exists "billing_invoices_update_own" on public.billing_invoices;
create policy "billing_invoices_update_own"
on public.billing_invoices
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "billing_invoices_delete_own" on public.billing_invoices;
create policy "billing_invoices_delete_own"
on public.billing_invoices
for delete using (auth.uid() = user_id);
