-- Shops and branches.
--
-- A "shop" is one trading location. The owner's primary shop keeps the historic
-- id (the owner's auth uid), so every existing row stays exactly where it is —
-- `created_by_id` still points at a shop. A branch is a second `shop` row with a
-- generated id, owned by the same account; its records are simply rows whose
-- `created_by_id` is that branch id.
--
-- Plan limits are enforced here, not in the browser:
--   Free    : 1 shop
--   Premium : 2 shops
--   Ultra   : unlimited
-- `public.create_shop()` counts the owner's shops and refuses the call past the
-- limit, so `SHOP_LIMITS` in src/lib/plans.js is only the mirror the UI shows.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- The shop itself
-- ---------------------------------------------------------------------------

create table if not exists public.shop (
  id text primary key,
  owner_id text not null,
  name text not null,
  address text,
  is_primary boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists shop_owner_idx on public.shop (owner_id);

-- The account a shop belongs to. A shop without a row (a primary shop that has
-- not been created yet) is its own owner: its id is the owner's auth uid.
create or replace function public.shop_owner_id(p_shop text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select s.owner_id from public.shop s where s.id = p_shop),
    p_shop
  );
$$;

-- Does the signed-in account own this shop (any branch of it)?
create or replace function public.is_shop_owner(p_shop text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() is not null
    and public.shop_owner_id(p_shop) = auth.uid()::text;
$$;

-- How many shops a plan may run; null means unlimited.
create or replace function public.shop_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan when 'ultra' then null when 'premium' then 2 else 1 end;
$$;

-- The plan in force for a shop — every branch runs on the owner's plan, so the
-- subscription row is looked up under the owner's id.
create or replace function public.shop_effective_plan(p_shop text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case
      when s.pending_plan is not null
        and s.pending_plan_effective_at is not null
        and s.pending_plan_effective_at <= now() then s.pending_plan
      else s.plan
    end
    from public.shop_subscription s
    where s.shop_id = public.shop_owner_id(p_shop)
  ), 'free');
$$;

revoke all on function public.shop_owner_id(text) from public;
revoke all on function public.is_shop_owner(text) from public;
revoke all on function public.shop_limit(text) from public;
revoke all on function public.shop_effective_plan(text) from public;
grant execute on function public.shop_owner_id(text) to authenticated;
grant execute on function public.is_shop_owner(text) to authenticated;
grant execute on function public.shop_limit(text) to authenticated;
grant execute on function public.shop_effective_plan(text) to authenticated;

-- Plan details (plan + billing dates) for a shop, for its owner or an employee.
create or replace function public.shop_billing(p_shop text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select case
    when not (public.is_shop_owner(p_shop) or public.is_shop_member(p_shop)) then null
    else jsonb_build_object(
      'plan', public.shop_effective_plan(p_shop),
      'pending_plan', (select pending_plan from public.shop_subscription where shop_id = public.shop_owner_id(p_shop)),
      'pending_plan_effective_at', (select pending_plan_effective_at from public.shop_subscription where shop_id = public.shop_owner_id(p_shop)),
      'current_period_end', (select current_period_end from public.shop_subscription where shop_id = public.shop_owner_id(p_shop))
    )
  end;
$$;

revoke all on function public.shop_billing(text) from public;
grant execute on function public.shop_billing(text) to authenticated;

-- Create the caller's primary shop row if it is missing (names it after the
-- business details they already saved, or their profile).
create or replace function public.ensure_shop()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  row public.shop;
  seeded text;
begin
  if uid is null then
    raise exception 'Sign in to load your shops.' using errcode = '28000';
  end if;

  select * into row from public.shop where owner_id = uid and is_primary limit 1;
  if found then
    return to_jsonb(row);
  end if;

  select nullif(btrim(coalesce(s.business ->> 'name', '')), '') into seeded
  from public.shop_settings s
  where s.created_by_id = uid
  limit 1;

  if seeded is null then
    select coalesce(nullif(btrim(coalesce(p.full_name, '')), ''), p.email) into seeded
    from public.profiles p
    where p.id::text = uid;
  end if;

  insert into public.shop (id, owner_id, name, is_primary)
  values (uid, uid, coalesce(seeded, 'My shop'), true)
  on conflict (id) do nothing;

  select * into row from public.shop where id = uid;
  return to_jsonb(row);
end $$;

revoke all on function public.ensure_shop() from public;
grant execute on function public.ensure_shop() to authenticated;

-- Owner: add a branch, within the plan's shop limit.
create or replace function public.create_shop(p_name text, p_address text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  plan_now text;
  max_shops integer;
  used integer;
  new_id text;
  clean_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if uid is null then
    raise exception 'Sign in to add a shop.' using errcode = '28000';
  end if;
  if clean_name is null then
    raise exception 'Give the shop or branch a name.';
  end if;
  if exists (
    select 1 from public.shop_member m
    where m.member_id = uid and m.status = 'active'
  ) then
    raise exception 'Only the shop owner can add a branch.';
  end if;

  perform public.ensure_shop();

  plan_now := public.shop_effective_plan(uid);
  max_shops := public.shop_limit(plan_now);
  select count(*) into used from public.shop where owner_id = uid;

  if max_shops is not null and used >= max_shops then
    raise exception
      'Your % plan covers % — upgrade to add another shop or branch.',
      initcap(plan_now),
      case max_shops when 1 then 'one shop' else max_shops || ' shops' end;
  end if;

  new_id := gen_random_uuid()::text;

  insert into public.shop (id, owner_id, name, address, is_primary)
  values (new_id, uid, clean_name, nullif(btrim(coalesce(p_address, '')), ''), false);

  -- Every branch starts with the primary shop's receipt details (name included)
  -- so printing a receipt works before the owner edits anything.
  insert into public.shop_settings (id, created_by_id, business, receipt, logo_url)
  select
    encode(extensions.gen_random_bytes(9), 'hex'),
    new_id,
    jsonb_set(coalesce(s.business, '{}'::jsonb), '{name}', to_jsonb(clean_name)),
    coalesce(s.receipt, '{}'::jsonb),
    s.logo_url
  from (select 1) one
  left join public.shop_settings s on s.created_by_id = uid
  where not exists (select 1 from public.shop_settings existing where existing.created_by_id = new_id);

  return jsonb_build_object(
    'id', new_id,
    'name', clean_name,
    'address', nullif(btrim(coalesce(p_address, '')), ''),
    'is_primary', false,
    'plan', plan_now,
    'shop_count', used + 1
  );
end $$;

revoke all on function public.create_shop(text, text) from public;
grant execute on function public.create_shop(text, text) to authenticated;

-- Owner: rename a shop or branch. The matching settings row follows, so the
-- receipt header matches the shop name.
create or replace function public.rename_shop(p_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to rename a shop.' using errcode = '28000';
  end if;
  if not public.is_shop_owner(p_id) then
    raise exception 'Only the shop owner can rename it.';
  end if;
  if clean_name is null then
    raise exception 'Give the shop or branch a name.';
  end if;

  update public.shop
  set name = clean_name, updated_date = now()
  where id = p_id;

  update public.shop_settings
  set business = jsonb_set(coalesce(business, '{}'::jsonb), '{name}', to_jsonb(clean_name)),
      updated_date = now()
  where created_by_id = p_id;

  return jsonb_build_object('id', p_id, 'name', clean_name);
end $$;

revoke all on function public.rename_shop(text, text) from public;
grant execute on function public.rename_shop(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: a shop row is readable by its owner and by that shop's
-- employees. Rows are only ever written by the functions above.
-- ---------------------------------------------------------------------------

alter table public.shop enable row level security;

drop policy if exists shop_read on public.shop;
create policy shop_read on public.shop
  for select to authenticated
  using (owner_id = auth.uid()::text or public.is_shop_member(id));

grant select on public.shop to authenticated;
revoke insert, update, delete on public.shop from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Every app table: the owner of the shop (any branch) on a plan that covers the
-- module, or an employee holding the module for that shop.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select *
    from (values
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
      'using ((public.is_shop_owner(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) is not null)',
      r.tbl || '_shop_select', r.tbl, r.read_modules, r.read_modules
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check ((public.is_shop_owner(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_insert', r.tbl, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using ((public.is_shop_owner(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'') '
      'with check ((public.is_shop_owner(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_update', r.tbl, r.write_modules, r.write_modules, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using ((public.is_shop_owner(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_delete', r.tbl, r.write_modules, r.write_modules
    );
  end loop;
end $$;

-- Shop settings: one row per shop (a branch has its own). The owner edits any
-- branch; that shop's employees may read it (receipts need the business details).
drop policy if exists shop_settings_owner_all on public.shop_settings;
drop policy if exists shop_settings_read on public.shop_settings;
drop policy if exists shop_settings_owner_write on public.shop_settings;
drop policy if exists shop_settings_owner_update on public.shop_settings;
drop policy if exists shop_settings_owner_delete on public.shop_settings;

create policy shop_settings_read on public.shop_settings
  for select to authenticated
  using (public.is_shop_owner(created_by_id) or public.is_shop_member(created_by_id));

create policy shop_settings_owner_write on public.shop_settings
  for insert to authenticated
  with check (public.is_shop_owner(created_by_id));

create policy shop_settings_owner_update on public.shop_settings
  for update to authenticated
  using (public.is_shop_owner(created_by_id))
  with check (public.is_shop_owner(created_by_id));

create policy shop_settings_owner_delete on public.shop_settings
  for delete to authenticated
  using (public.is_shop_owner(created_by_id));

-- Membership and invitations follow the branch they were created for.
drop policy if exists shop_member_read on public.shop_member;
create policy shop_member_read on public.shop_member
  for select to authenticated
  using (public.is_shop_owner(shop_id) or member_id = auth.uid()::text);

drop policy if exists shop_member_owner_insert on public.shop_member;
create policy shop_member_owner_insert on public.shop_member
  for insert to authenticated
  with check (public.is_shop_owner(shop_id));

drop policy if exists shop_member_owner_update on public.shop_member;
create policy shop_member_owner_update on public.shop_member
  for update to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

drop policy if exists shop_member_owner_delete on public.shop_member;
create policy shop_member_owner_delete on public.shop_member
  for delete to authenticated
  using (public.is_shop_owner(shop_id));

drop policy if exists shop_invite_owner_all on public.shop_invite;
create policy shop_invite_owner_all on public.shop_invite
  for all to authenticated
  using (public.is_shop_owner(shop_id))
  with check (public.is_shop_owner(shop_id));

-- ---------------------------------------------------------------------------
-- The owner's own shop rows, for the branch switcher.
-- ---------------------------------------------------------------------------

create or replace function public.my_shops()
returns setof public.shop
language sql
security definer
stable
set search_path = public
as $$
  select * from public.shop
  where owner_id = auth.uid()::text
  order by is_primary desc, created_date asc;
$$;

revoke all on function public.my_shops() from public;
grant execute on function public.my_shops() to authenticated;
