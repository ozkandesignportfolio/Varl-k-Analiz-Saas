alter table public.assets
add column if not exists qr_code text;

alter table public.assets
alter column qr_code
set default ('AC-' || upper(substr(md5(gen_random_uuid()::text), 1, 10)));

update public.assets
set qr_code = ('AC-' || upper(substr(md5(gen_random_uuid()::text), 1, 10)))
where qr_code is null;

alter table public.assets
alter column qr_code
set not null;

create unique index if not exists idx_assets_qr_code
on public.assets (qr_code);
