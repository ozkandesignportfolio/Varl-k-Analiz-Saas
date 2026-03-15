create table if not exists public.subscription_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  plan_code text not null check (plan_code in ('starter', 'pro', 'elite')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  source text not null default 'landing-page',
  created_at timestamptz not null default now()
);

alter table public.subscription_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.subscription_requests
  alter column user_id set default auth.uid();

create index if not exists idx_subscription_requests_created_at
on public.subscription_requests (created_at desc);

create index if not exists idx_subscription_requests_email
on public.subscription_requests (email);

create index if not exists idx_subscription_requests_user_id_created_at
on public.subscription_requests (user_id, created_at desc);

alter table public.subscription_requests enable row level security;

drop policy if exists "subscription_requests_insert_own" on public.subscription_requests;
create policy "subscription_requests_insert_own"
on public.subscription_requests
for insert
to authenticated
with check (
  auth.uid() = user_id
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and status = 'new'
);

drop policy if exists "deny_all_subscription_requests" on public.subscription_requests;
create policy "deny_all_subscription_requests"
on public.subscription_requests
for all
using (false)
with check (false);
