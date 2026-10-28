-- Shop employees: invitations, memberships and per-module permissions.
--
-- A shop is the owner's account (`shop_id` = owner auth uid), which is also the
-- `created_by_id` every app row already carries. An employee is a `shop_member`
-- row linking their auth uid to that shop; `permissions` maps a module key to
-- "view" or "edit" ("see and do"), and is enforced here — the navigation only
-- mirrors what these policies already allow.
--
-- One shop per employee: `shop_member.member_id` is unique.
--
-- Invitations are single-use, expiring and bound to the invited address: only
-- the SHA-256 hash of the token is stored, and `accept_shop_invite()` refuses a
-- link opened by a different signed-in account.
--
-- Owner access is unchanged: every policy still starts with
-- `created_by_id = auth.uid()`, so nothing an owner could do before became
-- harder. Applied to the app's Supabase project; safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.shop_member (
  id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  shop_id text not null,
  member_id text not null,
  member_email text not null,
  role text not null default 'Employee',
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active'
);

-- One shop per employee.
create unique index if not exists shop_member_member_id_key
  on public.shop_member (member_id);
create unique index if not exists shop_member_shop_email_key
  on public.shop_member (shop_id, lower(member_email));

create table if not exists public.shop_invite (
  id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  shop_id text not null,
  email text not null,
  role text not null default 'Employee',
  permissions jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by_id text
);

-- One open invitation per address per shop; a re-invite replaces the old link.
create unique index if not exists shop_invite_pending_key
  on public.shop_invite (shop_id, lower(email))
  where accepted_at is null;

create index if not exists shop_invite_shop_idx on public.shop_invite (shop_id);

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

-- Highest level the caller holds for a shop across the given modules:
-- 'edit', 'view', or null when they are not a member (or hold none of them).
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
    ) then 'view'
  end;
$$;

revoke all on function public.shop_module_level(text, text[]) from public;
grant execute on function public.shop_module_level(text, text[]) to authenticated;

-- Is the caller an active employee of this shop?
create or replace function public.is_shop_member(p_shop text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_member m
    where m.member_id = auth.uid()::text
      and m.shop_id = p_shop
      and m.status = 'active'
  );
$$;

revoke all on function public.is_shop_member(text) from public;
grant execute on function public.is_shop_member(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Every app table: owner, or an employee with the matching module
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      -- table, modules that may read it, modules that may write it
      ('product',            array['dashboard','pos','inventory','daily_sales','reports','accounting'], array['inventory','pos']),
      ('sale',               array['dashboard','pos','cashup','daily_sales','reports','accounting'], array['pos']),
      ('customer',           array['pos','customers','debtors','reports'],                             array['pos','customers','debtors']),
      ('expense',            array['dashboard','expenses','accounting','reports'],                     array['expenses','accounting']),
      ('cash_up',            array['dashboard','cashup','reports'],                                    array['cashup']),
      ('bank_account',       array['banking','accounting'],                                            array['banking']),
      ('supplier',           array['suppliers'],                                                       array['suppliers']),
      ('purchase_order',     array['suppliers'],                                                       array['suppliers']),
      ('stock_adjustment',   array['inventory'],                                                       array['inventory']),
      ('savings_group',      array['myspaza_card'],                                                    array['myspaza_card']),
      ('stockfell_account',  array['myspaza_card'],                                                    array['myspaza_card']),
      ('wholesaler',         array['myspaza_card'],                                                    array['myspaza_card']),
      ('wholesaler_discount',array['myspaza_card'],                                                    array['myspaza_card']),
      ('bulk_buy',           array['myspaza_card'],                                                    array['myspaza_card'])
    ) as t(tbl, read_modules, write_modules)
  loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_owner_all', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_shop_select', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_shop_insert', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_shop_update', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_shop_delete', r.tbl);

    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (created_by_id = auth.uid()::text '
      '  or public.shop_module_level(created_by_id, %L::text[]) is not null)',
      r.tbl || '_shop_select', r.tbl, r.read_modules
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check (created_by_id = auth.uid()::text '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_insert', r.tbl, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (created_by_id = auth.uid()::text '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'') '
      'with check (created_by_id = auth.uid()::text '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_update', r.tbl, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using (created_by_id = auth.uid()::text '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_delete', r.tbl, r.write_modules
    );
  end loop;
end $$;

-- The POS receipt prints the shop's name, logo and footer, so employees read
-- the shop's settings. Only the owner may change them.
drop policy if exists shop_settings_owner_all on public.shop_settings;
drop policy if exists shop_settings_read on public.shop_settings;
drop policy if exists shop_settings_write on public.shop_settings;

create policy shop_settings_read on public.shop_settings
  for select to authenticated
  using (created_by_id = auth.uid()::text or public.is_shop_member(created_by_id));

create policy shop_settings_write on public.shop_settings
  for all to authenticated
  using (created_by_id = auth.uid()::text)
  with check (created_by_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Membership + invitation access
-- ---------------------------------------------------------------------------

alter table public.shop_member enable row level security;

drop policy if exists shop_member_owner_all on public.shop_member;
drop policy if exists shop_member_read on public.shop_member;
drop policy if exists shop_member_owner_insert on public.shop_member;
drop policy if exists shop_member_owner_update on public.shop_member;
drop policy if exists shop_member_owner_delete on public.shop_member;

-- An employee sees their own membership (which shop, which role, which
-- modules); the owner sees every membership of their shop.
create policy shop_member_read on public.shop_member
  for select to authenticated
  using (shop_id = auth.uid()::text or member_id = auth.uid()::text);

create policy shop_member_owner_insert on public.shop_member
  for insert to authenticated
  with check (shop_id = auth.uid()::text);

create policy shop_member_owner_update on public.shop_member
  for update to authenticated
  using (shop_id = auth.uid()::text)
  with check (shop_id = auth.uid()::text);

create policy shop_member_owner_delete on public.shop_member
  for delete to authenticated
  using (shop_id = auth.uid()::text);

alter table public.shop_invite enable row level security;

drop policy if exists shop_invite_owner_all on public.shop_invite;

-- The owner manages invitations; employees never touch this table (they accept
-- through the security-definer function below).
create policy shop_invite_owner_all on public.shop_invite
  for all to authenticated
  using (shop_id = auth.uid()::text)
  with check (shop_id = auth.uid()::text);

grant select, insert, update, delete on public.shop_member to authenticated;
grant select, insert, update, delete on public.shop_invite to authenticated;
revoke all on public.shop_member from anon;
revoke all on public.shop_invite from anon;

-- ---------------------------------------------------------------------------
-- Accepting an invitation
-- ---------------------------------------------------------------------------

-- What the invitee sees before signing in: shop name, role, modules. Safe to
-- expose to anon — the caller must already hold the token.
create or replace function public.shop_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  inv public.shop_invite;
  shop_name text;
begin
  select * into inv
  from public.shop_invite
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid');
  end if;
  if inv.accepted_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'accepted');
  end if;
  if inv.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expired');
  end if;

  select nullif(btrim(coalesce(s.business ->> 'name', '')), '') into shop_name
  from public.shop_settings s
  where s.created_by_id = inv.shop_id;

  if shop_name is null then
    select nullif(btrim(coalesce(p.full_name, '')), '') into shop_name
    from public.profiles p
    where p.id::text = inv.shop_id;
  end if;

  return jsonb_build_object(
    'valid', true,
    'shop_name', coalesce(shop_name, 'A My Spaza shop'),
    'role', inv.role,
    'permissions', inv.permissions,
    'email', inv.email,
    'expires_at', inv.expires_at
  );
end $$;

revoke all on function public.shop_invite_preview(text) from public;
grant execute on function public.shop_invite_preview(text) to anon, authenticated;

-- Single use, bound to the invited address, one shop per employee.
create or replace function public.accept_shop_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.shop_invite;
  uid text := auth.uid()::text;
  user_email text;
  existing public.shop_member;
begin
  if uid is null then
    raise exception 'Sign in to accept this invitation.' using errcode = '28000';
  end if;

  select * into inv
  from public.shop_invite
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if not found then
    raise exception 'This invitation link is not valid.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been accepted.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask the shop owner to invite you again.';
  end if;

  select email into user_email from auth.users where id = auth.uid();
  if user_email is null or lower(user_email) <> lower(inv.email) then
    raise exception 'Sign in with the invited email address (%).', inv.email;
  end if;

  select * into existing from public.shop_member where member_id = uid;
  if found and existing.shop_id <> inv.shop_id then
    raise exception 'You already belong to another shop. Ask for your access to be removed first.';
  end if;

  if found then
    update public.shop_member
    set role = inv.role,
        permissions = inv.permissions,
        status = 'active',
        member_email = lower(inv.email),
        updated_date = now()
    where member_id = uid;
  else
    insert into public.shop_member (id, shop_id, member_id, member_email, role, permissions, status)
    values (
      encode(extensions.gen_random_bytes(9), 'hex'),
      inv.shop_id, uid, lower(inv.email), inv.role, inv.permissions, 'active'
    );
  end if;

  update public.shop_invite
  set accepted_at = now(), updated_date = now()
  where id = inv.id;

  return jsonb_build_object(
    'shop_id', inv.shop_id,
    'role', inv.role,
    'permissions', inv.permissions
  );
end $$;

revoke all on function public.accept_shop_invite(text) from public;
grant execute on function public.accept_shop_invite(text) to authenticated;
