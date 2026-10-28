-- Signed-in shop owners upload product photos straight from the app, so the
-- public media bucket needs a write policy for authenticated users. Reads stay
-- public (the bucket is public); deletes/updates remain restricted.
--
-- Applied to the app's Supabase project; safe to re-run.

drop policy if exists bucket_inventory_media_write on storage.objects;
create policy bucket_inventory_media_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inventory-media');
