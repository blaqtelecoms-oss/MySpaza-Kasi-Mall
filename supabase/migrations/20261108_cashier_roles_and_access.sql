-- Cashier roles, per-person access rules, and the plan's staff allowance.
--
-- Before this migration a store had exactly three identical till slots. Now a
-- slot has a role — cashier or supervisor — and its own module access map, so
-- the owner can hand a supervisor the cash-up and reports while a cashier only
-- rings up sales. Slot 2 becomes the supervisor; slots 1 and 3 stay cashiers.
--
-- How many of each role a store may run is the store's plan:
--   free      1 cashier, no supervisor
--   premium   2 cashiers, 1 supervisor
--   ultra     unlimited cashiers and supervisors (`null` = no cap)
-- `STAFF_LIMITS` in src/lib/plans.js mirrors those numbers for the UI; the
-- functions below are the enforcement, so a crafted call cannot add a portal
-- the plan does not cover.
--
-- Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Role and access rules on a till slot
-- ---------------------------------------------------------------------------

alter table public.shop_cashier add column if not exists role text not null default 'cashier';
alter table public.shop_cashier add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.shop_cashier drop constraint if exists shop_cashier_role_check;
alter table public.shop_cashier
  add constraint shop_cashier_role_check check (role in ('cashier', 'supervisor'));

-- A plan's cashier allowance can be higher than three (Ultra is unlimited), so
-- the old "slot between 1 and 3" cap has to go.
alter table public.shop_cashier drop constraint if exists shop_cashier_slot_check;
alter table public.shop_cashier
  add constraint shop_cashier_slot_check check (slot >= 1);

-- Slot 2 was "Cashier 2" on every store. It is the supervisor now. Guarded on
-- the default name so re-running never re-promotes a portal the owner renamed.
update public.shop_cashier
   set role = 'supervisor',
       full_name = case when full_name = 'Cashier 2' then 'Supervisor' else full_name end,
       updated_date = now()
 where slot = 2
   and role = 'cashier'
   and full_name = 'Cashier 2';

-- Existing portals start with the access rules of their role.
update public.shop_cashier
   set permissions = '{"pos":"edit","inventory":"view","daily_sales":"view"}'::jsonb,
       updated_date = now()
 where permissions = '{}'::jsonb
   and role = 'cashier';

update public.shop_cashier
   set permissions = '{"pos":"edit","inventory":"edit","cashup":"edit","daily_sales":"view","reports":"view"}'::jsonb,
       updated_date = now()
 where permissions = '{}'::jsonb
   and role = 'supervisor';

-- Stores used to start with three till slots on every plan. Extra cashier slots
-- beyond what the plan covers are removed, but only the ones nobody has used: a
-- slot with a password or a name the owner chose is left alone, so the trim can
-- never lock a person out or rename somebody behind the owner's back.
with ranked as (
  select c.id,
         row_number() over (partition by c.shop_id, c.role order by c.slot) as rn,
         public.shop_staff_limit(c.shop_id, c.role) as lim
  from public.shop_cashier c
  where c.role = 'cashier'
    and c.full_name ~ '^Cashier [0-9]+$'
    and not exists (
      select 1 from public.shop_cashier_secret x where x.cashier_id = c.id
    )
)
delete from public.shop_cashier
 where id in (select id from ranked where lim is not null and rn > lim);

-- ---------------------------------------------------------------------------
-- The plan's staff allowance
-- ---------------------------------------------------------------------------

create or replace function public.shop_staff_limit(p_shop text, p_role text)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case public.shop_effective_plan(p_shop)
    when 'ultra' then null::integer
    when 'premium' then case when p_role = 'supervisor' then 1 else 2 end
    else case when p_role = 'supervisor' then 0 else 1 end
  end;
$$;

revoke all on function public.shop_staff_limit(text, text) from public;
grant execute on function public.shop_staff_limit(text, text) to authenticated;

create or replace function public.shop_staff_count(p_shop text, p_role text)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer
  from public.shop_cashier c
  where c.shop_id = p_shop and c.role = p_role;
$$;

revoke all on function public.shop_staff_count(text, text) from public;
grant execute on function public.shop_staff_count(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeding a store's portals
-- ---------------------------------------------------------------------------

-- Every store starts with one cashier portal, plus a supervisor portal when the
-- plan includes supervisors. Only missing slots are created, so re-running it
-- never duplicates a portal and never removes one the owner added.
create or replace function public.shop_seed_cashiers(p_shop text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supervisor integer;
begin
  insert into public.shop_cashier (id, shop_id, slot, full_name, role, permissions)
  select replace(gen_random_uuid()::text, '-', ''), p_shop, 1, 'Cashier 1', 'cashier',
         '{"pos":"edit","inventory":"view","daily_sales":"view"}'::jsonb
  where not exists (
    select 1 from public.shop_cashier c where c.shop_id = p_shop and c.slot = 1
  );

  v_supervisor := public.shop_staff_limit(p_shop, 'supervisor');
  if v_supervisor is null or v_supervisor > 0 then
    insert into public.shop_cashier (id, shop_id, slot, full_name, role, permissions)
    select replace(gen_random_uuid()::text, '-', ''), p_shop, 2, 'Supervisor', 'supervisor',
           '{"pos":"edit","inventory":"edit","cashup":"edit","daily_sales":"view","reports":"view"}'::jsonb
    where not exists (
      select 1 from public.shop_cashier c where c.shop_id = p_shop and c.slot = 2
    );
  end if;
end $$;

revoke all on function public.shop_seed_cashiers(text) from public;

-- ---------------------------------------------------------------------------
-- Owner: add, re-role and remove portals within the plan's allowance
-- ---------------------------------------------------------------------------

create or replace function public.add_shop_cashier(p_shop text, p_role text, p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(nullif(btrim(p_role), ''), 'cashier');
  v_noun text;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_limit integer;
  v_count integer;
  v_slot integer;
  v_id text := replace(gen_random_uuid()::text, '-', '');
  v_permissions jsonb;
  v_message text;
begin
  if not public.is_shop_owner(p_shop) then
    raise exception 'Only the store owner can add staff portals.' using errcode = '42501';
  end if;
  if v_role not in ('cashier', 'supervisor') then
    raise exception 'Choose cashier or supervisor.' using errcode = '22023';
  end if;

  v_noun := case when v_role = 'supervisor' then 'supervisor' else 'cashier' end;

  -- A store that has never been seeded gets its first portals first, so the
  -- plan's allowance is counted against the full picture.
  perform public.shop_seed_cashiers(p_shop);

  v_limit := public.shop_staff_limit(p_shop, v_role);
  v_count := public.shop_staff_count(p_shop, v_role);

  if v_limit = 0 then
    raise exception 'Your plan does not include a supervisor portal. Upgrade to add one.'
      using errcode = 'P0001';
  end if;

  if v_limit is not null and v_count >= v_limit then
    v_message := 'Your plan covers ' || v_limit || ' ' || v_noun
      || case when v_limit = 1 then '' else 's' end
      || '. Upgrade your plan or remove one first.';
    raise exception '%', v_message using errcode = 'P0001';
  end if;

  if v_name = '' then
    v_name := initcap(v_noun) || ' ' || (v_count + 1);
  end if;
  if length(v_name) > 60 then
    raise exception 'Keep the name under 60 characters.' using errcode = '22023';
  end if;

  select coalesce(max(c.slot), 0) + 1 into v_slot
  from public.shop_cashier c
  where c.shop_id = p_shop;

  v_permissions := case
    when v_role = 'supervisor'
      then '{"pos":"edit","inventory":"edit","cashup":"edit","daily_sales":"view","reports":"view"}'::jsonb
    else '{"pos":"edit","inventory":"view","daily_sales":"view"}'::jsonb
  end;

  insert into public.shop_cashier (id, shop_id, slot, full_name, role, permissions)
  values (v_id, p_shop, v_slot, v_name, v_role, v_permissions);

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'slot', v_slot,
    'full_name', v_name, 'role', v_role, 'permissions', v_permissions
  );
end $$;

revoke all on function public.add_shop_cashier(text, text, text) from public;
grant execute on function public.add_shop_cashier(text, text, text) to authenticated;

create or replace function public.set_shop_cashier_role(p_cashier_id text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.shop_cashier;
  v_role text := btrim(coalesce(p_role, ''));
  v_limit integer;
  v_count integer;
  v_message text;
begin
  select * into c from public.shop_cashier where id = p_cashier_id;
  if not found then
    raise exception 'That portal no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can change a portal role.' using errcode = '42501';
  end if;
  if v_role not in ('cashier', 'supervisor') then
    raise exception 'Choose cashier or supervisor.' using errcode = '22023';
  end if;
  if v_role = c.role then
    return jsonb_build_object('ok', true, 'id', c.id, 'role', c.role);
  end if;

  v_limit := public.shop_staff_limit(c.shop_id, v_role);
  v_count := public.shop_staff_count(c.shop_id, v_role);

  if v_limit = 0 then
    raise exception 'Your plan does not include a supervisor portal. Upgrade to add one.'
      using errcode = 'P0001';
  end if;

  if v_limit is not null and v_count >= v_limit then
    v_message := 'Your plan covers ' || v_limit || ' '
      || case when v_role = 'supervisor' then 'supervisor' else 'cashier' end
      || case when v_limit = 1 then '' else 's' end
      || '. Upgrade your plan or change another portal first.';
    raise exception '%', v_message using errcode = 'P0001';
  end if;

  update public.shop_cashier
    set role = v_role, updated_date = now()
    where id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id, 'role', v_role);
end $$;

revoke all on function public.set_shop_cashier_role(text, text) from public;
grant execute on function public.set_shop_cashier_role(text, text) to authenticated;

-- The access rules of one portal: module key -> "view" or "edit", the same map
-- an employee membership carries (src/lib/modules.js). Unknown keys and levels
-- are refused so the shell never shows a screen the database does not know.
create or replace function public.set_shop_cashier_permissions(p_cashier_id text, p_permissions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.shop_cashier;
  v_key text;
  v_level text;
  v_allowed text[] := array[
    'pos', 'inventory', 'cashup', 'daily_sales', 'expenses', 'suppliers',
    'customers', 'debtors', 'banking', 'accounting', 'reports', 'academy',
    'calculators', 'coach', 'funding', 'myspaza_card'
  ];
begin
  select * into c from public.shop_cashier where id = p_cashier_id;
  if not found then
    raise exception 'That portal no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can change a portal''s access.' using errcode = '42501';
  end if;
  if p_permissions is null or jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'Send the access as a map of screens.' using errcode = '22023';
  end if;

  for v_key, v_level in select key, value from jsonb_each_text(p_permissions) loop
    if not (v_key = any (v_allowed)) then
      raise exception 'Unknown screen: %', v_key using errcode = '22023';
    end if;
    if v_level not in ('view', 'edit') then
      raise exception 'Access must be view or edit.' using errcode = '22023';
    end if;
  end loop;

  update public.shop_cashier
    set permissions = p_permissions, updated_date = now()
    where id = c.id;

  -- A portal whose access changed starts again on the new rules.
  delete from public.shop_portal_session where cashier_id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id, 'permissions', p_permissions);
end $$;

revoke all on function public.set_shop_cashier_permissions(text, jsonb) from public;
grant execute on function public.set_shop_cashier_permissions(text, jsonb) to authenticated;

create or replace function public.delete_shop_cashier(p_cashier_id text)
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
    raise exception 'That portal no longer exists.' using errcode = 'P0002';
  end if;
  if not public.is_shop_owner(c.shop_id) then
    raise exception 'Only the store owner can remove a portal.' using errcode = '42501';
  end if;

  delete from public.shop_cashier_secret where cashier_id = c.id;
  delete from public.shop_portal_session where cashier_id = c.id;
  delete from public.shop_cashier where id = c.id;

  return jsonb_build_object('ok', true, 'id', c.id, 'role', c.role);
end $$;

revoke all on function public.delete_shop_cashier(text) from public;
grant execute on function public.delete_shop_cashier(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading a store's portals (names, roles and rules — never a hash)
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
    'plan', public.shop_effective_plan(p_shop),
    'staff_limits', jsonb_build_object(
      'cashier', public.shop_staff_limit(p_shop, 'cashier'),
      'supervisor', public.shop_staff_limit(p_shop, 'supervisor')
    ),
    'owner_password_set', exists (
      select 1 from public.shop_owner_portal o where o.shop_id = p_shop
    ),
    'cashiers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'slot', c.slot,
          'full_name', c.full_name,
          'role', c.role,
          'permissions', c.permissions,
          'has_password', exists (
            select 1 from public.shop_cashier_secret x where x.cashier_id = c.id
          )
        )
        order by c.role, c.slot
      )
      from public.shop_cashier c
      where c.shop_id = p_shop
    ), '[]'::jsonb)
  );
end $$;

revoke all on function public.my_portal_options(text) from public;
grant execute on function public.my_portal_options(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Opening a portal carries its role and access rules into the session
-- ---------------------------------------------------------------------------

create or replace function public.current_portal_session()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select to_jsonb(s) || jsonb_build_object(
    'cashier_name', c.full_name,
    'cashier_role', c.role,
    'cashier_permissions', c.permissions
  )
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

-- Same function as before, now reporting the role and rules it opened with so
-- the shell can enter the right screens straight away.
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
    raise exception 'That portal does not work in this store.' using errcode = 'P0002';
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
    'cashier_id', c.id, 'cashier_name', c.full_name,
    'cashier_role', c.role, 'cashier_permissions', c.permissions,
    'expires_at', expires
  );
end $$;

revoke all on function public.open_cashier_portal_slot(text, text, text) from public;
grant execute on function public.open_cashier_portal_slot(text, text, text) to authenticated;
