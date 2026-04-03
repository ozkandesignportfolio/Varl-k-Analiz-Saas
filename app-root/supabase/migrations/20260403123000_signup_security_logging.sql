begin;

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  ip text,
  user_agent text,
  accepted_terms boolean not null,
  accepted_privacy_policy boolean not null,
  accepted_kvkk boolean not null,
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists user_consents_user_created_at_idx
  on public.user_consents (user_id, created_at desc);

create index if not exists user_consents_email_created_at_idx
  on public.user_consents (email, created_at desc);

create index if not exists user_consents_ip_created_at_idx
  on public.user_consents (ip, created_at desc);

alter table public.user_consents enable row level security;

revoke all on table public.user_consents from anon, authenticated, public;
grant all on table public.user_consents to service_role;

create table if not exists public.auth_security_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  ip text,
  user_agent text,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_security_logs_event_created_at_idx
  on public.auth_security_logs (event_type, created_at desc);

create index if not exists auth_security_logs_email_created_at_idx
  on public.auth_security_logs (email, created_at desc);

create index if not exists auth_security_logs_ip_created_at_idx
  on public.auth_security_logs (ip, created_at desc);

create index if not exists auth_security_logs_user_created_at_idx
  on public.auth_security_logs (user_id, created_at desc);

alter table public.auth_security_logs enable row level security;

revoke all on table public.auth_security_logs from anon, authenticated, public;
grant all on table public.auth_security_logs to service_role;

commit;
