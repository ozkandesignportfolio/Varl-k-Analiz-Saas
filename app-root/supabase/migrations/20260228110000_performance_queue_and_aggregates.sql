begin;

create table if not exists public.media_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  service_log_id uuid not null references public.service_logs(id) on delete cascade,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_media_enrichment_jobs_user_service_idempotency
  on public.media_enrichment_jobs(user_id, service_log_id, idempotency_key);

create index if not exists idx_media_enrichment_jobs_user_created_at
  on public.media_enrichment_jobs(user_id, created_at desc);

create index if not exists idx_media_enrichment_jobs_status_created_at
  on public.media_enrichment_jobs(status, created_at asc);

alter table public.media_enrichment_jobs enable row level security;

drop policy if exists "media_enrichment_jobs_select_own" on public.media_enrichment_jobs;
create policy "media_enrichment_jobs_select_own"
on public.media_enrichment_jobs
for select
using (auth.uid() = user_id);

drop policy if exists "media_enrichment_jobs_insert_own" on public.media_enrichment_jobs;
create policy "media_enrichment_jobs_insert_own"
on public.media_enrichment_jobs
for insert
with check (auth.uid() = user_id);

commit;
