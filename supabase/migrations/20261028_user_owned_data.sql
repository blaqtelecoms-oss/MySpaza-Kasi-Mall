-- Per-user data isolation.
--
-- Every app table used to allow any signed-in user to read and write every row
-- (`*_authenticated_all` policies with `true`). Access now follows ownership:
-- a row belongs to the auth user recorded in `created_by_id`, so a new account
-- starts with an empty workspace and can never see or change another account's
-- records.
--
-- Rows whose owner cannot be identified (`created_by_id is null`) are hidden
-- from ordinary users rather than deleted or reassigned. A row owned by a real
-- account stays visible to that account.
--
-- Idempotent: safe to re-run.

-- Is the caller an admin? SECURITY DEFINER so the profiles policies below can
-- use it without recursing into profiles' own row level security.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- The imported accounts kept their previous (24-character) user id in
-- `profiles.base44_id`, and older rows still carry that id in `created_by_id`.
-- Re-point those rows at the account's current auth id so the original owner
-- keeps their own records. Rows whose creator has no account (for example the
-- imported service account) are left untouched and stay private.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_account',
    'bulk_buy',
    'cash_up',
    'customer',
    'expense',
    'product',
    'purchase_order',
    'sale',
    'savings_group',
    'stock_adjustment',
    'stockfell_account',
    'supplier',
    'wholesaler',
    'wholesaler_discount'
  ]
  loop
    execute format(
      'update public.%I r set created_by_id = p.id::text '
      'from public.profiles p '
      'where p.base44_id is not null '
      '  and r.created_by_id = p.base44_id '
      '  and r.created_by_id <> p.id::text',
      t
    );
  end loop;
end $$;

-- One owner-scoped policy per app table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bank_account',
    'bulk_buy',
    'cash_up',
    'customer',
    'expense',
    'product',
    'purchase_order',
    'sale',
    'savings_group',
    'stock_adjustment',
    'stockfell_account',
    'supplier',
    'wholesaler',
    'wholesaler_discount'
  ]
  loop
    -- New rows inherit their owner from the session even if the client omits it.
    execute format(
      'alter table public.%I alter column created_by_id set default auth.uid()::text',
      t
    );

    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (created_by_id = auth.uid()::text) '
      'with check (created_by_id = auth.uid()::text)',
      t || '_owner_all', t
    );
  end loop;
end $$;

-- Profiles: a user sees and edits only their own row. Operators (`role =
-- 'admin'`) still see every profile.
drop policy if exists profiles_authenticated_all on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- A user may edit their own profile but cannot grant themselves a role.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- Delivery log stays operator-only.
drop policy if exists email_event_admin_read on public.email_event;
create policy email_event_admin_read on public.email_event
  for select to authenticated
  using (public.is_admin());

-- Asset registry describes other accounts' uploads, so it is operator-only as
-- well. The media bucket itself stays public, so product photos keep working.
drop policy if exists media_assets_authenticated_read on public.media_assets;
drop policy if exists media_assets_admin_read on public.media_assets;
create policy media_assets_admin_read on public.media_assets
  for select to authenticated
  using (public.is_admin());
