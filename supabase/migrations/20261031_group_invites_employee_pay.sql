-- Community group invitations (stokvel, savings groups, bulk buys) and
-- employee pay details.
--
-- A group invitation names one group the owner runs — a stokvel savings
-- account, a savings group row or a bulk buy order — and is bound to the
-- invited email address exactly like a shop invitation: only the SHA-256 hash
-- of the token is stored, the link works once and expires after a week.
-- Acceptance appends the signed-in account to that group's `members` list.
--
-- Employee records gain the employee's name and monthly salary, captured when
-- the invitation is sent (on `shop_invite`) and copied onto the membership
-- (`shop_member`) when it is accepted. Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Employee name + monthly salary
-- ---------------------------------------------------------------------------

alter table public.shop_member add column if not exists full_name text;
alter table public.shop_member add column if not exists monthly_salary numeric;
alter table public.shop_invite add column if not exists full_name text;
alter table public.shop_invite add column if not exists monthly_salary numeric;

-- A stokvel keeps its members on the account, like a savings group does.
alter table public.stockfell_account
  add column if not exists members jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Group invitations
-- ---------------------------------------------------------------------------

create table if not exists public.group_invite (
  id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  shop_id text not null,
  group_kind text not null check (group_kind in ('stokvel', 'savings_group', 'bulk_buy')),
  group_id text not null,
  group_name text not null,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by_id text
);

-- One open invitation per address per group; re-inviting replaces the old link.
create unique index if not exists group_invite_pending_key
  on public.group_invite (shop_id, group_kind, group_id, lower(email))
  where accepted_at is null;

create index if not exists group_invite_shop_idx on public.group_invite (shop_id);

alter table public.group_invite enable row level security;

drop policy if exists group_invite_owner_all on public.group_invite;

-- The owner manages invitations for the shops and branches they own; an
-- invitee never reads this table (acceptance goes through the function below).
create policy group_invite_owner_all on public.group_invite
  for all to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

grant select, insert, update, delete on public.group_invite to authenticated;
revoke all on public.group_invite from anon;

-- ---------------------------------------------------------------------------
-- Preview + acceptance
-- ---------------------------------------------------------------------------

-- What an invitee sees before signing in. Safe for anon: the caller must hold
-- the token, and only the group's name is revealed.
create or replace function public.group_invite_preview(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  inv public.group_invite;
  shop_name text;
begin
  select * into inv
  from public.group_invite
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
    'group_kind', inv.group_kind,
    'group_name', inv.group_name,
    'shop_name', coalesce(shop_name, 'A My Spaza shop'),
    'email', inv.email,
    'expires_at', inv.expires_at
  );
end $$;

revoke all on function public.group_invite_preview(text) from public;
grant execute on function public.group_invite_preview(text) to anon, authenticated;

-- Single use, bound to the invited address: the signed-in account joins the
-- group's member list, and joining twice does not duplicate the member.
create or replace function public.accept_group_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.group_invite;
  uid text := auth.uid()::text;
  user_email text;
  member_name text;
  current_members jsonb;
  new_members jsonb;
  v_total_cost double precision;
  v_total_quantity double precision;
  v_max_members double precision;
begin
  if uid is null then
    raise exception 'Sign in to accept this invitation.' using errcode = '28000';
  end if;

  select * into inv
  from public.group_invite
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  if not found then
    raise exception 'This invitation link is not valid.';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invitation has already been accepted.';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invitation has expired. Ask the owner to invite you again.';
  end if;

  select email into user_email from auth.users where id = auth.uid();
  if user_email is null or lower(user_email) <> lower(inv.email) then
    raise exception 'Sign in with the invited email address (%).', inv.email;
  end if;

  select nullif(btrim(coalesce(full_name, '')), '') into member_name
  from public.profiles
  where id = auth.uid();
  member_name := coalesce(member_name, split_part(user_email, '@', 1));

  if inv.group_kind = 'savings_group' then
    select members into current_members
    from public.savings_group
    where id = inv.group_id and created_by_id = inv.shop_id
    for update;

    if not found then
      raise exception 'That savings group is no longer available.';
    end if;

    if not exists (
      select 1 from jsonb_array_elements(coalesce(current_members, '[]'::jsonb)) m
      where lower(coalesce(m ->> 'email', '')) = lower(user_email)
    ) then
      new_members := coalesce(current_members, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('name', member_name, 'email', lower(user_email), 'contributed', 0, 'status', 'pending')
      );
      update public.savings_group
      set members = new_members,
          member_count = coalesce(member_count, 0) + 1,
          updated_date = now()
      where id = inv.group_id;
    end if;

  elsif inv.group_kind = 'bulk_buy' then
    select members, total_cost, total_quantity, max_members
      into current_members, v_total_cost, v_total_quantity, v_max_members
    from public.bulk_buy
    where id = inv.group_id and created_by_id = inv.shop_id
    for update;

    if not found then
      raise exception 'That bulk buy is no longer available.';
    end if;

    if not exists (
      select 1 from jsonb_array_elements(coalesce(current_members, '[]'::jsonb)) m
      where lower(coalesce(m ->> 'email', '')) = lower(user_email)
    ) then
      new_members := coalesce(current_members, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('name', member_name, 'email', lower(user_email), 'quantity', 0, 'amount', 0, 'paid', false)
      );
      update public.bulk_buy
      set members = new_members,
          member_count = jsonb_array_length(new_members),
          per_member_cost = round((coalesce(v_total_cost, 0) / greatest(jsonb_array_length(new_members), 1))::numeric, 2)::double precision,
          per_member_quantity = round((coalesce(v_total_quantity, 0) / greatest(jsonb_array_length(new_members), 1))::numeric, 2)::double precision,
          status = case
            when v_max_members is not null and jsonb_array_length(new_members) >= v_max_members then 'filled'
            else status
          end,
          updated_date = now()
      where id = inv.group_id;
    end if;

  elsif inv.group_kind = 'stokvel' then
    select members into current_members
    from public.stockfell_account
    where id = inv.group_id and created_by_id = inv.shop_id
    for update;

    if not found then
      raise exception 'That stokvel is no longer available.';
    end if;

    if not exists (
      select 1 from jsonb_array_elements(coalesce(current_members, '[]'::jsonb)) m
      where lower(coalesce(m ->> 'email', '')) = lower(user_email)
    ) then
      new_members := coalesce(current_members, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object('name', member_name, 'email', lower(user_email), 'contributed', 0, 'status', 'pending')
      );
      update public.stockfell_account
      set members = new_members,
          updated_date = now()
      where id = inv.group_id;
    end if;

  else
    raise exception 'This invitation is not for a group.';
  end if;

  update public.group_invite
  set accepted_at = now(), updated_date = now()
  where id = inv.id;

  return jsonb_build_object(
    'group_kind', inv.group_kind,
    'group_id', inv.group_id,
    'group_name', inv.group_name
  );
end $$;

revoke all on function public.accept_group_invite(text) from public;
grant execute on function public.accept_group_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Employee invitations now carry the employee's name and monthly salary
-- ---------------------------------------------------------------------------

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
        full_name = coalesce(inv.full_name, existing.full_name),
        monthly_salary = coalesce(inv.monthly_salary, existing.monthly_salary),
        updated_date = now()
    where member_id = uid;
  else
    insert into public.shop_member (id, shop_id, member_id, member_email, role, permissions, status, full_name, monthly_salary)
    values (
      encode(extensions.gen_random_bytes(9), 'hex'),
      inv.shop_id, uid, lower(inv.email), inv.role, inv.permissions, 'active',
      inv.full_name, inv.monthly_salary
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
