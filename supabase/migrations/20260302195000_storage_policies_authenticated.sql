alter policy "documents_select_own_folder" on storage.objects to authenticated;
alter policy "documents_insert_own_folder" on storage.objects to authenticated;
alter policy "documents_update_own_folder" on storage.objects to authenticated;
alter policy "documents_delete_own_folder" on storage.objects to authenticated;
alter policy "asset_media_select_own_folder" on storage.objects to authenticated;
alter policy "asset_media_insert_own_folder" on storage.objects to authenticated;
alter policy "asset_media_update_own_folder" on storage.objects to authenticated;
alter policy "asset_media_delete_own_folder" on storage.objects to authenticated;
