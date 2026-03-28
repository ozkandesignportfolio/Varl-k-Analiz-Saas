create table if not exists public.asset_media (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('image', 'video', 'audio')),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_media_asset_created
on public.asset_media(asset_id, created_at desc);

create index if not exists idx_asset_media_user
on public.asset_media(user_id);

alter table public.asset_media enable row level security;

drop policy if exists "asset_media_select_own" on public.asset_media;
create policy "asset_media_select_own"
on public.asset_media
for select
using (auth.uid() = user_id);

drop policy if exists "asset_media_insert_own" on public.asset_media;
create policy "asset_media_insert_own"
on public.asset_media
for insert
with check (auth.uid() = user_id);

drop policy if exists "asset_media_update_own" on public.asset_media;
create policy "asset_media_update_own"
on public.asset_media
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "asset_media_delete_own" on public.asset_media;
create policy "asset_media_delete_own"
on public.asset_media
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-media',
  'asset-media',
  false,
  31457280,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/webm',
    'audio/ogg'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "asset_media_select_own_folder" on storage.objects;
create policy "asset_media_select_own_folder"
on storage.objects
for select
using (
  bucket_id = 'asset-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "asset_media_insert_own_folder" on storage.objects;
create policy "asset_media_insert_own_folder"
on storage.objects
for insert
with check (
  bucket_id = 'asset-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "asset_media_update_own_folder" on storage.objects;
create policy "asset_media_update_own_folder"
on storage.objects
for update
using (
  bucket_id = 'asset-media'
  and auth.uid()::text = (storage.foldername(name))[2]
)
with check (
  bucket_id = 'asset-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

drop policy if exists "asset_media_delete_own_folder" on storage.objects;
create policy "asset_media_delete_own_folder"
on storage.objects
for delete
using (
  bucket_id = 'asset-media'
  and auth.uid()::text = (storage.foldername(name))[2]
);

