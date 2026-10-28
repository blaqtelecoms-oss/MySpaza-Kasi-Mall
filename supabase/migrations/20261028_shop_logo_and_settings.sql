-- Shop branding storage + per-shop settings.
--
-- `shop-logos` is a public bucket because the logo is shown on the settings
-- screen and on printed receipts (a public URL is what makes the <img> work
-- from both). Only a signed-in owner can write, and only inside the folder
-- named after their user id, so one shop can never overwrite another's logo.
--
-- `public.shop_settings` keeps one row per account: the business details and
-- the receipt options (`business`, `receipt`) plus the uploaded `logo_url`.
-- It follows the same ownership model as every other app table
-- (`created_by_id = auth.uid()`), so each account configures only its own shop.
--
-- Applied to the app's Supabase project; safe to re-run.

insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists bucket_shop_logos_read on storage.objects;
create policy bucket_shop_logos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'shop-logos');

drop policy if exists bucket_shop_logos_write on storage.objects;
create policy bucket_shop_logos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists bucket_shop_logos_delete on storage.objects;
create policy bucket_shop_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create table if not exists public.shop_settings (
  id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by_id text not null default auth.uid()::text unique,
  business jsonb not null default '{}'::jsonb,
  receipt jsonb not null default '{}'::jsonb,
  logo_url text
);

alter table public.shop_settings enable row level security;

drop policy if exists shop_settings_owner_all on public.shop_settings;
create policy shop_settings_owner_all on public.shop_settings
  for all to authenticated
  using (created_by_id = auth.uid()::text)
  with check (created_by_id = auth.uid()::text);

grant select, insert, update, delete on public.shop_settings to authenticated;
revoke all on public.shop_settings from anon;
