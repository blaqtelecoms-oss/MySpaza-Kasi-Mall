-- Portal passwords: every store has three preset cashiers, and the owner portal
-- has its own password, separate from the account's sign-in password.
--
-- This replaces the invited-by-email cashier model. A store gets "Cashier 1",
-- "Cashier 2" and "Cashier 3" when it is created (and this migration backfills
-- the stores that already exist). The owner renames them and sets each one's
-- password on the Employees screen; a cashier portal opens only with that
-- cashier's password, the owner portal only with the store's owner password.
--
-- Hashes live in tables with row level security on and **no policy at all**, so
-- no browser can read them. Only the security-definer functions below touch
-- them, and they record the open portal in `shop_portal_session` — which is what
-- the app's table policies already check for an employee's session.
--
-- Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The three till slots of a store. Names are the owner's to edit, so this table
-- is readable by the owner; the password lives in the secret table below.
create table if not exists public.shop_cashier (
  id text primary key,
  shop_id text not null,
  slot integer not null check (slot between 1 and 3),
  full_name text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create unique index if not exists shop_cashier_slot_key
  on public.shop_cashier (shop_id, slot);

create table if not exists public.shop_cashier_secret (
  cashier_id text primary key,
  shop_id text not null,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_date timestamptz not null default now()
);

create index if not exists shop_cashier_secret_shop_idx
  on public.shop_cashier_secret (shop_id);

-- One owner portal password per store. No default: until the owner creates one
-- the owner portal cannot be opened, which is what makes it a real password
-- rather than a screen.
create table if not exists public.shop_owner_portal (
  shop_id text primary key,
  password_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_date timestamptz not null default now()
);

alter table public.shop_portal_session
  add column if not exists cashier_id text;

alter table public.shop_cashier enable row level security;
alter table public.shop_cashier_secret enable row level security;
alter table public.shop_owner_portal enable row level security;

drop policy if exists shop_cashier_owner_read on public.shop_cashier;
create policy shop_cashier_owner_read on public.shop_cashier
  for select to authenticated
  using (public.is_shop_owner(shop_id));

grant select on public.shop_cashier to authenticated;
revoke all on public.shop_cashier from anon;

-- Passwords are never readable, by anyone but the functions below.
revoke all on public.shop_cashier_secret from anon, authenticated;
revoke all on public.shop_owner_portal from anon, authenticated;

-- The invite-by-email cashier passwords are gone; a membership with no password
-- is open (the behaviour before portals existed), so legacy employees are not
-- left locked out. Open sessions restart under the new rules.
delete from public.shop_cashier_access;
delete from public.shop_portal_session;

-- ---------------------------------------------------------------------------
-- The three preset cashiers
-- ---------------------------------------------------------------------------

-- Idempotent: creates only the slots the store does not have yet, so running it
-- for a store that already has its three cashiers changes nothing.
create or replace function public.shop_seed_cashiers(p_shop text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shop_cashier (id, shop_id, slot, full_name)
  select replace(gen_random_uuid()::text, '-', ''), p_shop, g, 'Cashier ' || g
  from generate_series(1, 3) as g
  on conflict (shop_id, slot) do nothing;
end $$;

revoke all on function public.shop_seed_cashiers(text) from public;

-- Every new store starts with its three cashiers.
create or replace function public.shop_seed_cashiers_on_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.shop_seed_cashiers(new.id);
  return new;
end $$;

drop trigger if exists shop_seed_cashiers on public.shop;
create trigger shop_seed_cashiers
  after insert on public.shop
  for each row execute function public.shop_seed_cashiers_on_shop();

-- Stores created before this migration get theirs now.
do $$
declare
  s text;
begin
  for s in select id from public.shop loop
    perform public.shop_seed_cashiers(s);
  end loop;
end $$;

-- A store whose `shop` row does not exist yet (the primary shop keeps the
-- account id) is covered by the portal screen calling this.
create or replace function public.ensure_shop_cashiers(p_shop text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_shop_owner(p_shop) then
    raise exception 'Only the store owner can set up cashiers.' using errcode = '42501';
  end if;
  perform public.shop_seed_cashiers(p_shop);
  return jsonb_build_object('ok', true, 'shop_id', p_shop);
end $$;

revoke all on function public.ensure_shop_cashiers(text) from public;
grant execute on function public.ensure_shop_cashiers(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading a store's portals (names and status, never a hash)
-- ---------------------------------------------------------------------------

create or replace function public.my_portal_options(p_shop text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  v_owner := public.is_shop_owner(p_shop);
  if not v_owner and not public.is_shop_member(p_shop) then
    raise exception 'This account does not work in that store.' using errcode = '42501';
  end if;

  perform public.shop_seed_cashiers(p_shop);

  return jsonb_build_object(
    'shop_id', p_shop,
    'is_owner', v_owner,
    'owner_password_set', exists (
      select 1 from public.shop_owner_portal o where o.shop_id = p_shop
    ),
    'cashiers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'slot', c.slot,
          'full_name', c.full_name,
          'has_password', exists (
            select 1 from public.shop_cashier_secret x where x.cashier_id = c.id
          )
        )
        order by c.slot
      )
      from public.shop_cashier c
      where c.shop_id = p_shop
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.my_portal_options(text) from public;
grant execute on function public.my_portal_options(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner portal password
-- ---------------------------------------------------------------------------

create or replace function public.set_owner_portal_password(p_shop text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_shop_owner(p_shop) then
    raise exception 'Only the store owner can set the owner portal password.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_password), '') = '' then
    raise exception 'Enter an owner portal password.' using errcode = '22023';
  end if;
  if length(p_password) < 6 then
    raise exception 'The owner portal password needs at least 6 characters.' using errcode = '22023';
  end if;

  insert into public.shop_owner_portal (shop_id, password_hash, failed_attempts, locked_until, updated_date)
  values (p_shop, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (shop_id) do update
    set password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_date = now();

  -- A changed password closes owner portals already open on that store.
  delete from public.shop_portal_session
  where shop_id = p_shop and method = 'owner';

  return jsonb_build_object('ok', true, 'shop_id', p_shop);
end $$;

revoke all on function public.set_owner_portal_password(text, text) from public;
grant execute on function public.set_owner_portal_password(text, text) to authenticated;

create or replace function public.open_owner_portal(p_shop text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  o public.shop_owner_portal;
  expires timestamptz := now() + interval '12 hours';
begin
  if not public.is_shop_owner(p_shop) then
    raise exception 'Only this store''s owner can open the owner portal.' using errcode = '42501';
  end if;

  select * into o from public.shop_owner_portal where shop_id = p_shop;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_set');
  end if;

  if o.locked_until is not null and o.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', o.locked_until);
  end if;

  if extensions.crypt(coalesce(p_password, ''), o.password_hash) <> o.password_hash then
    update public.shop_owner_portal
      set failed_attempts = o.failed_attempts + 1,
          locked_until = case
            when o.failed_attempts + 1 >= 5 then now() + interval '5 minutes'
            else o.locked_until
          end,
          updated_date = now()
      where shop_id = p_shop;

    return jsonb_build_object(
      'ok', false, 'reason', 'invalid',
      'attempts_left', greatest(5 - (o.failed_attempts + 1), 0)
    );
  end if;

  update public.shop_owner_portal
    set failed_attempts = 0, locked_until = null
    where shop_id = p_shop;

  delete from public.shop_portal_session
  where shop_id = p_shop and expires_at <= now();

  insert into public.shop_portal_session (id, member_id, shop_id, method, expires_at)
  values (gen_random_uuid()::text, auth.uid()::text, p_shop, 'owner', expires);

  return jsonb_build_object(
    'ok', true, 'method', 'owner', 'shop_id', p_shop, 'expires_at', expires
  );
end $$;

revoke all on function public.open_owner_portal(text, text) from public;
grant execute on function public.open_owner_portal(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Cashier portals
-- ---------------------------------------------------------------------------

-- `p_cashier_id` is one of the store's three slots, chosen in the dropdown. The
-- store's account and its employees may both open a slot, with that slot's
-- password — the till is shared, the password is what the owner hands out.
create or replace function public.open_cashier_portal_slot(p_shop text, p_cashier_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid text := auth.uid()::text;
  c public.shop_cashier;
  a public.shop_cashier_secret;
  v_member text;
  v_session_member text;
  expires timestamptz := now() + interval '12 hours';
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  if not public.is_shop_owner(p_shop) and not public.is_shop_member(p_shop) then
    raise exception 'This account does not work in that store.' using errcode = '42501';
  end if;

  select * into c from public.shop_cashier where id = p_cashier_id and shop_id = p_shop;
  if not found then
    raise exception 'That cashier does not work in this store.' using errcode = 'P0002';
  end if;

  select * into a from public.shop_cashier_secret where cashier_id = c.id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_set', 'cashier_id', c.id);
  end if;

  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object(
      'ok', false, 'reason', 'locked',
      'locked_until', a.locked_until, 'cashier_id', c.id
    );
  end if;

  if extensions.crypt(coalesce(p_password, ''), a.password_hash) <> a.password_hash then
    update public.shop_cashier_secret
      set failed_attempts = a.failed_attempts + 1,
          locked_until = case
            when a.failed_attempts + 1 >= 5 then now() + interval '5 minutes'
            else a.locked_until
          end,
          updated_date = now()
      where cashier_id = c.id;

    return jsonb_build_object(
      'ok', false, 'reason', 'invalid', 'cashier_id', c.id,
      'attempts_left', greatest(5 - (a.failed_attempts + 1), 0)
    );
  end if;

  update public.shop_cashier_secret
    set failed_attempts = 0, locked_until = null
    where cashier_id = c.id;

  -- An employee's session keys on their membership row, because that is what
  -- `shop_portal_open()` is asked about; the store's own account keys on its
  -- auth id.
  select m.id into v_member
  from public.shop_member m
  where m.member_id = uid and m.shop_id = p_shop and m.status = 'active';

  v_session_member := coalesce(v_member, uid);

  delete from public.shop_portal_session
  where member_id = v_session_member and expires_at <= now();

  insert into public.shop_portal_session (id, member_id, shop_id, method, cashier_id, expires_at)
  values (gen_random_uuid()::text, v_session_member, p_shop, 'cashier', c.id, expires);

  return jsonb_build_object(
    'ok', true, 'method', 'cashier', 'shop_id', p_shop,
    'cashier_id', c.id, 'cashier_name', c.full_name, 'expires_at', expires
  );
end $$;

revoke all on function public.open_cashier_portal_slot(text, text, text) from public;
grant execute on function public.open_cashier_portal_slot(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Owner: manage the three cashiers
-- ---------------------------------------------------------------------------

create or replace function public.rename_shop_cashier(p_cashier_id text, p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.shop_cashier;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  select * into c from public.shop_cashier where id = p_cashier_id;
  if not found then
    raise exception 'That cashier no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can rename a cashier.' using errcode = '42501';
  end if;
  if v_name = '' then
    raise exception 'Enter a name for this cashier.' using errcode = '22023';
  end if;
  if length(v_name) > 60 then
    raise exception 'Keep the cashier name under 60 characters.' using errcode = '22023';
  end if;

  update public.shop_cashier
    set full_name = v_name, updated_date = now()
    where id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id, 'full_name', v_name);
end $$;

revoke all on function public.rename_shop_cashier(text, text) from public;
grant execute on function public.rename_shop_cashier(text, text) to authenticated;

create or replace function public.set_shop_cashier_password(p_cashier_id text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  c public.shop_cashier;
begin
  select * into c from public.shop_cashier where id = p_cashier_id;
  if not found then
    raise exception 'That cashier no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can set a cashier password.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_password), '') = '' then
    raise exception 'Enter a password for this cashier.' using errcode = '22023';
  end if;
  if length(p_password) < 6 then
    raise exception 'The cashier password needs at least 6 characters.' using errcode = '22023';
  end if;

  insert into public.shop_cashier_secret
    (cashier_id, shop_id, password_hash, failed_attempts, locked_until, updated_date)
  values
    (c.id, c.shop_id, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (cashier_id) do update
    set shop_id = excluded.shop_id,
        password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_date = now();

  -- A changed password closes any portal already open on that till.
  delete from public.shop_portal_session where cashier_id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id);
end $$;

revoke all on function public.set_shop_cashier_password(text, text) from public;
grant execute on function public.set_shop_cashier_password(text, text) to authenticated;

create or replace function public.clear_shop_cashier_password(p_cashier_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.shop_cashier;
begin
  select * into c from public.shop_cashier where id = p_cashier_id;
  if not found then
    raise exception 'That cashier no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can change a cashier password.' using errcode = '42501';
  end if;

  delete from public.shop_cashier_secret where cashier_id = c.id;
  delete from public.shop_portal_session where cashier_id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id);
end $$;

revoke all on function public.clear_shop_cashier_password(text) from public;
grant execute on function public.clear_shop_cashier_password(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The open portal, so a reload stays where the person was
-- ---------------------------------------------------------------------------

create or replace function public.current_portal_session()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select to_jsonb(s) || jsonb_build_object('cashier_name', c.full_name)
  from public.shop_portal_session s
  left join public.shop_cashier c on c.id = s.cashier_id
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
