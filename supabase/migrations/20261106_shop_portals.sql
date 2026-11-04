-- Store portals: after signing in, a person picks the store and the Owner or
-- Cashier portal. The owner portal is the owner's own account; each cashier has
-- an individual password the owner sets for them on the Employees screen.
--
-- The password is a real gate, not a screen: `shop_module_level()` (which every
-- app table policy uses) only counts a membership whose cashier password is
-- unset or whose portal session is open. A membership without a password keeps
-- working exactly as before, so nobody is locked out by applying this.
--
-- Hashes live in `shop_cashier_access`, which has row level security on and no
-- policy at all: no client can read a hash. Only the security-definer functions
-- below touch that table. Applied to the app's Supabase project; safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- `member_id` is the `shop_member` row id the owner edits on the team screen
-- (not the person's auth uid), so both sides of the gate name the same row.
create table if not exists public.shop_cashier_access (
  member_id text primary key,
  shop_id text not null,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_date timestamptz not null default now(),
  updated_by text
);

create index if not exists shop_cashier_access_shop_idx
  on public.shop_cashier_access (shop_id);

create table if not exists public.shop_portal_session (
  id text primary key,
  member_id text not null,
  shop_id text not null,
  method text not null default 'cashier',
  expires_at timestamptz not null,
  created_date timestamptz not null default now()
);

create index if not exists shop_portal_session_member_idx
  on public.shop_portal_session (member_id);

alter table public.shop_cashier_access enable row level security;
alter table public.shop_portal_session enable row level security;

-- No policies on purpose: the definer functions below are the only door, so a
-- password hash never reaches a browser.
revoke all on public.shop_cashier_access from anon, authenticated;
revoke all on public.shop_portal_session from anon, authenticated;

-- Removing an employee also removes their password and any open session.
create or replace function public.shop_member_portal_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.shop_cashier_access where member_id in (old.id, old.member_id);
  delete from public.shop_portal_session where member_id in (old.id, old.member_id);
  return old;
end $$;

drop trigger if exists shop_member_portal_cleanup on public.shop_member;
create trigger shop_member_portal_cleanup
  after delete on public.shop_member
  for each row execute function public.shop_member_portal_cleanup();

-- ---------------------------------------------------------------------------
-- Portal state
-- ---------------------------------------------------------------------------

-- Is this membership through the portal gate right now? A membership without a
-- cashier password is always open (the pre-portals behaviour).
create or replace function public.shop_portal_open(p_member_id text, p_shop text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.shop_cashier_access a where a.member_id = p_member_id
  ) or exists (
    select 1
    from public.shop_portal_session s
    where s.member_id = p_member_id
      and s.shop_id = p_shop
      and s.expires_at > now()
  );
$$;

revoke all on function public.shop_portal_open(text, text) from public;
grant execute on function public.shop_portal_open(text, text) to authenticated;

-- Every app table policy reads this, so the cashier password gates the data
-- itself — not only the menu. Same rules as before, plus the portal session.
create or replace function public.shop_module_level(p_shop text, p_modules text[])
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.shop_member m
      join lateral jsonb_each_text(m.permissions) perm on true
      where m.member_id = auth.uid()::text
        and m.shop_id = p_shop
        and m.status = 'active'
        and perm.key = any(p_modules)
        and perm.value = 'edit'
        and public.shop_plan_level(p_shop, array[perm.key])
        and public.shop_portal_open(m.id, p_shop)
    ) then 'edit'
    when exists (
      select 1
      from public.shop_member m
      join lateral jsonb_each_text(m.permissions) perm on true
      where m.member_id = auth.uid()::text
        and m.shop_id = p_shop
        and m.status = 'active'
        and perm.key = any(p_modules)
        and perm.value in ('view', 'edit')
        and public.shop_plan_level(p_shop, array[perm.key])
        and public.shop_portal_open(m.id, p_shop)
    ) then 'view'
  end;
$$;

revoke all on function public.shop_module_level(text, text[]) from public;
grant execute on function public.shop_module_level(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner: manage each cashier's password
-- ---------------------------------------------------------------------------

create or replace function public.set_cashier_password(p_member_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  m public.shop_member;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select * into m from public.shop_member where id = p_member_id;
  if not found then
    raise exception 'That employee no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(m.shop_id) then
    raise exception 'Only the store owner can set a cashier password.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_password), '') = '' then
    raise exception 'Enter a password for this cashier.' using errcode = '22023';
  end if;
  if length(p_password) < 6 then
    raise exception 'The cashier password needs at least 6 characters.' using errcode = '22023';
  end if;

  insert into public.shop_cashier_access
    (member_id, shop_id, password_hash, failed_attempts, locked_until, updated_date, updated_by)
  values
    (p_member_id, m.shop_id, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), 0, null, now(), auth.uid()::text)
  on conflict (member_id) do update
    set shop_id = excluded.shop_id,
        password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_date = now(),
        updated_by = auth.uid()::text;

  -- A changed password ends any cashier session already open on a till.
  delete from public.shop_portal_session where member_id = p_member_id;

  return jsonb_build_object('member_id', p_member_id, 'updated_date', now());
end $$;

revoke all on function public.set_cashier_password(text, text) from public;
grant execute on function public.set_cashier_password(text, text) to authenticated;

create or replace function public.clear_cashier_password(p_member_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.shop_member;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select * into m from public.shop_member where id = p_member_id;
  if not found then
    raise exception 'That employee no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(m.shop_id) then
    raise exception 'Only the store owner can change a cashier password.' using errcode = '42501';
  end if;

  delete from public.shop_cashier_access where member_id = p_member_id;
  delete from public.shop_portal_session where member_id = p_member_id;
  return jsonb_build_object('member_id', p_member_id, 'cleared', true);
end $$;

revoke all on function public.clear_cashier_password(text) from public;
grant execute on function public.clear_cashier_password(text) to authenticated;

-- Which employees of this store already have a password (never the hash).
-- `shop_member_id` is the membership row id the team screen lists.
create or replace function public.cashier_password_status(p_shop text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('shop_member_id', m.id, 'updated_date', a.updated_date)
      order by a.updated_date desc
    ),
    '[]'::jsonb
  )
  from public.shop_cashier_access a
  join public.shop_member m
    on m.id = a.member_id
   and m.shop_id = a.shop_id
  where a.shop_id = p_shop
    and public.is_shop_owner(p_shop);
$$;

revoke all on function public.cashier_password_status(text) from public;
grant execute on function public.cashier_password_status(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Opening a portal
-- ---------------------------------------------------------------------------

create or replace function public.unlock_owner_portal(p_shop text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expires timestamptz := now() + interval '12 hours';
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if not public.is_shop_owner(p_shop) then
    raise exception 'Only this store''s owner can open the owner portal.' using errcode = '42501';
  end if;

  insert into public.shop_portal_session (id, member_id, shop_id, method, expires_at)
  values (gen_random_uuid()::text, auth.uid()::text, p_shop, 'owner', expires);

  return jsonb_build_object(
    'ok', true, 'method', 'owner', 'shop_id', p_shop, 'expires_at', expires
  );
end $$;

revoke all on function public.unlock_owner_portal(text) from public;
grant execute on function public.unlock_owner_portal(text) to authenticated;

-- `p_password` is ignored when the owner has not set one for this cashier, so a
-- team that has not adopted passwords yet keeps working.
create or replace function public.unlock_cashier_portal(p_shop text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid text := auth.uid()::text;
  m public.shop_member;
  a public.shop_cashier_access;
  has_password boolean := false;
  expires timestamptz := now() + interval '12 hours';
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select * into m
  from public.shop_member
  where member_id = uid and shop_id = p_shop and status = 'active';
  if not found then
    raise exception 'This account does not work in that store.' using errcode = '42501';
  end if;

  select * into a from public.shop_cashier_access where member_id = m.id;
  has_password := found;

  if has_password then
    if a.locked_until is not null and a.locked_until > now() then
      return jsonb_build_object(
        'ok', false, 'reason', 'locked',
        'locked_until', a.locked_until, 'password_set', true
      );
    end if;

    if extensions.crypt(coalesce(p_password, ''), a.password_hash) <> a.password_hash then
      update public.shop_cashier_access
        set failed_attempts = a.failed_attempts + 1,
            locked_until = case
              when a.failed_attempts + 1 >= 5 then now() + interval '5 minutes'
              else a.locked_until
            end,
            updated_date = now()
        where member_id = a.member_id;

      return jsonb_build_object(
        'ok', false, 'reason', 'invalid', 'password_set', true,
        'attempts_left', greatest(5 - (a.failed_attempts + 1), 0)
      );
    end if;

    update public.shop_cashier_access
      set failed_attempts = 0, locked_until = null
      where member_id = a.member_id;
  end if;

  delete from public.shop_portal_session
  where member_id = m.id and expires_at <= now();

  insert into public.shop_portal_session (id, member_id, shop_id, method, expires_at)
  values (gen_random_uuid()::text, m.id, p_shop, 'cashier', expires);

  return jsonb_build_object(
    'ok', true, 'method', 'cashier', 'shop_id', p_shop, 'expires_at', expires,
    'password_set', has_password
  );
end $$;

revoke all on function public.unlock_cashier_portal(text, text) from public;
grant execute on function public.unlock_cashier_portal(text, text) to authenticated;

-- Does the caller work in this store, and is a cashier password set? Drives the
-- cashier card without ever exposing the hash.
create or replace function public.my_cashier_access(p_shop text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'member', true,
    'has_password', exists (
      select 1 from public.shop_cashier_access a where a.member_id = m.id
    )
  )
  from public.shop_member m
  where m.member_id = auth.uid()::text
    and m.shop_id = p_shop
    and m.status = 'active';
$$;

revoke all on function public.my_cashier_access(text) from public;
grant execute on function public.my_cashier_access(text) to authenticated;

-- The caller's open portal session, so a reload restores the chosen portal.
create or replace function public.current_portal_session()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select to_jsonb(s)
  from public.shop_portal_session s
  where s.expires_at > now()
    and (
      s.member_id = auth.uid()::text
      or s.member_id in (
        select m.id from public.shop_member m where m.member_id = auth.uid()::text
      )
    )
  order by s.expires_at desc
  limit 1;
$$;

revoke all on function public.current_portal_session() from public;
grant execute on function public.current_portal_session() to authenticated;

create or replace function public.close_portal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', true);
  end if;
  delete from public.shop_portal_session
  where member_id = auth.uid()::text
     or member_id in (
       select m.id from public.shop_member m where m.member_id = auth.uid()::text
     );
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.close_portal() from public;
grant execute on function public.close_portal() to authenticated;
