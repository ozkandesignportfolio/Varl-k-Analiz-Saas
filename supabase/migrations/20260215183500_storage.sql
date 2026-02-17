insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents-private',
  'documents-private',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "documents_select_own_folder" on storage.objects;
create policy "documents_select_own_folder"
on storage.objects
for select
using (
  bucket_id = 'documents-private'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "documents_insert_own_folder" on storage.objects;
create policy "documents_insert_own_folder"
on storage.objects
for insert
with check (
  bucket_id = 'documents-private'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "documents_update_own_folder" on storage.objects;
create policy "documents_update_own_folder"
on storage.objects
for update
using (
  bucket_id = 'documents-private'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'documents-private'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "documents_delete_own_folder" on storage.objects;
create policy "documents_delete_own_folder"
on storage.objects
for delete
using (
  bucket_id = 'documents-private'
  and auth.uid()::text = (storage.foldername(name))[1]
);

