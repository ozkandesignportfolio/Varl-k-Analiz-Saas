-- Harden documents pipeline without changing bucket configuration.

alter table public.documents
  drop constraint if exists documents_file_size_limit;

alter table public.documents
  add constraint documents_file_size_limit
  check (file_size is null or (file_size > 0 and file_size <= 52428800)) not valid;

alter table public.documents
  drop constraint if exists documents_storage_path_sane;

alter table public.documents
  add constraint documents_storage_path_sane
  check (
    storage_path <> ''
    and storage_path not like '/%'
    and storage_path not like '%//%'
    and position('..' in storage_path) = 0
    and storage_path ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}/.+'
    and storage_path ~ '^[^[:space:]]+$'
  ) not valid;

alter table public.documents
  drop constraint if exists documents_storage_path_matches_owner;

alter table public.documents
  add constraint documents_storage_path_matches_owner
  check (
    split_part(storage_path, '/', 1) = user_id::text
    and split_part(storage_path, '/', 2) = asset_id::text
  ) not valid;

create or replace function public.delete_document_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if old.storage_path is not null and old.storage_path <> '' then
    delete from storage.objects
    where bucket_id = 'documents-private'
      and name = old.storage_path;
  end if;

  return old;
end;
$$;

revoke all on function public.delete_document_storage_object() from public;
grant execute on function public.delete_document_storage_object() to postgres;

drop trigger if exists trg_documents_storage_delete on public.documents;

create trigger trg_documents_storage_delete
after delete on public.documents
for each row
execute function public.delete_document_storage_object();
