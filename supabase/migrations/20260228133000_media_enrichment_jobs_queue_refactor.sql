begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.media_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  service_log_id uuid not null references public.service_logs(id) on delete cascade,
  document_ids uuid[] not null default '{}'::uuid[],
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempts integer not null default 0,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.media_enrichment_jobs
  add column if not exists document_ids uuid[] not null default '{}'::uuid[],
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists idempotency_key text,
  add column if not exists created_at timestamptz not null default now();

update public.media_enrichment_jobs
set status = 'succeeded'
where status = 'completed';

update public.media_enrichment_jobs
set document_ids = '{}'::uuid[]
where document_ids is null;

update public.media_enrichment_jobs
set idempotency_key = encode(gen_random_bytes(16), 'hex')
where idempotency_key is null or btrim(idempotency_key) = '';

alter table public.media_enrichment_jobs
  alter column user_id set not null,
  alter column service_log_id set not null,
  alter column document_ids set not null,
  alter column status set not null,
  alter column status set default 'queued',
  alter column attempts set not null,
  alter column attempts set default 0,
  alter column idempotency_key set not null,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.media_enrichment_jobs
  drop column if exists asset_id,
  drop column if exists payload;

alter table public.media_enrichment_jobs
  drop constraint if exists media_enrichment_jobs_status_check;

alter table public.media_enrichment_jobs
  add constraint media_enrichment_jobs_status_check
  check (status in ('queued', 'processing', 'succeeded', 'failed'));

drop index if exists uq_media_enrichment_jobs_user_service_idempotency;
create unique index if not exists uq_media_enrichment_jobs_idempotency_key
  on public.media_enrichment_jobs(idempotency_key);

create index if not exists idx_media_enrichment_jobs_status_created_at
  on public.media_enrichment_jobs(status, created_at asc);

create index if not exists idx_media_enrichment_jobs_user_service_created_at
  on public.media_enrichment_jobs(user_id, service_log_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    execute 'drop trigger if exists trg_media_enrichment_jobs_updated_at on public.media_enrichment_jobs';
    execute 'create trigger trg_media_enrichment_jobs_updated_at before update on public.media_enrichment_jobs for each row execute function public.set_updated_at()';
  end if;
end $$;

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

drop policy if exists "media_enrichment_jobs_service_role_manage" on public.media_enrichment_jobs;
create policy "media_enrichment_jobs_service_role_manage"
on public.media_enrichment_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on table public.media_enrichment_jobs from anon;
revoke all on table public.media_enrichment_jobs from authenticated;
grant insert (user_id, service_log_id, document_ids, idempotency_key) on table public.media_enrichment_jobs to authenticated;
grant select (id, service_log_id, status, created_at, updated_at) on table public.media_enrichment_jobs to authenticated;
grant all on table public.media_enrichment_jobs to service_role;

create or replace function public.invoke_media_enrichment_worker()
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_base_url text := nullif(current_setting('app.settings.supabase_url', true), '');
  v_service_role_key text := nullif(current_setting('app.settings.service_role_key', true), '');
begin
  if v_base_url is null then
    v_base_url := 'https://frufbnurxhtrialetjdg.supabase.co';
  end if;

  if v_service_role_key is null then
    return;
  end if;

  perform net.http_post(
    url := v_base_url || '/functions/v1/media-enrichment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{}'::jsonb
  );
end;
$func$;

revoke all on function public.invoke_media_enrichment_worker() from public;
grant execute on function public.invoke_media_enrichment_worker() to service_role;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'media-enrichment-every-minute';

  perform cron.schedule(
    'media-enrichment-every-minute',
    '* * * * *',
    $cron$select public.invoke_media_enrichment_worker();$cron$
  );
end $$;

commit;
