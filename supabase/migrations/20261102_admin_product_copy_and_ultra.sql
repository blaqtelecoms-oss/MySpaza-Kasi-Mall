-- Operator tooling: copy every shop's catalogue into one account, and hand out
-- a time-unlimited Ultra plan with a hard store allowance.
--
-- Both actions run as SECURITY DEFINER functions that check `public.is_admin()`
-- first, so the RLS model is untouched: an ordinary account cannot call them,
-- and the copies are ordinary rows owned by the destination shop, exactly as if
-- that account had entered the products itself.
--
-- Idempotent: safe to re-run. `product_copy_log` records every source product
-- that has already been copied to a shop, so running the copy twice does not
-- duplicate the catalogue.

-- ---------------------------------------------------------------------------
-- Per-shop store allowance
-- ---------------------------------------------------------------------------

-- A shop may carry its own store allowance, overriding the plan's number.
-- null = fall back to the plan (Free 1, Premium 2, Ultra unlimited).
alter table public.shop_subscription
  add column if not exists max_shops integer
    check (max_shops is null or max_shops >= 1);

-- How many stores a shop may actually run: its own allowance when set, else the
-- plan's number. This is the value `create_shop` enforces.
create or replace function public.shop_store_limit(p_shop text)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select s.max_shops
     from public.shop_subscription s
     where s.shop_id = public.shop_owner_id(p_shop)),
    public.shop_limit(public.shop_effective_plan(p_shop))
  );
$$;

revoke all on function public.shop_store_limit(text) from public;
grant execute on function public.shop_store_limit(text) to authenticated;

-- Same function as 20261030_shop_branches.sql, now enforcing the shop's own
-- allowance so a capped shop cannot add a branch past it.
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
  max_shops := public.shop_store_limit(uid);
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

-- `shop_billing` now reports the allowance so the shop switcher and the plan
-- panel show the same number the database enforces.
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
      'current_period_end', (select current_period_end from public.shop_subscription where shop_id = public.shop_owner_id(p_shop)),
      'max_shops', public.shop_store_limit(p_shop)
    )
  end;
$$;

revoke all on function public.shop_billing(text) from public;
grant execute on function public.shop_billing(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Copy log: one row per source product already copied to a shop
-- ---------------------------------------------------------------------------

create table if not exists public.product_copy_log (
  id text primary key default encode(extensions.gen_random_bytes(9), 'hex'),
  source_product_id text not null,
  target_shop text not null,
  copied_at timestamptz not null default now(),
  unique (source_product_id, target_shop)
);

alter table public.product_copy_log enable row level security;

drop policy if exists product_copy_log_admin on public.product_copy_log;
create policy product_copy_log_admin on public.product_copy_log
  for select to authenticated
  using (public.is_admin());

-- The shop an account's data belongs to: the shop they work in when they are an
-- employee, otherwise their own account id (the primary shop keeps that id).
create or replace function public.admin_target_shop(p_email text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  clean text := lower(btrim(coalesce(p_email, '')));
  uid text;
  member_shop text;
begin
  if clean = '' then
    raise exception 'Give the account email to work on.';
  end if;

  select p.id::text into uid from public.profiles p where lower(p.email) = clean limit 1;
  if uid is null then
    select u.id::text into uid from auth.users u where lower(u.email) = clean limit 1;
  end if;
  if uid is null then
    raise exception 'No account found for %.', clean;
  end if;

  select m.shop_id into member_shop
  from public.shop_member m
  where m.member_id = uid and m.status = 'active'
  limit 1;

  return coalesce(member_shop, uid);
end $$;

revoke all on function public.admin_target_shop(text) from public;
grant execute on function public.admin_target_shop(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Copy every shop's products (with images and pricing) into one account
-- ---------------------------------------------------------------------------

create or replace function public.admin_copy_products(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop text;
  v_cols text;
  rec record;
  copied integer := 0;
  already integer := 0;
  failed integer := 0;
  source_shops integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an operator can copy a catalogue.' using errcode = '42501';
  end if;

  v_shop := public.admin_target_shop(p_email);

  if to_regclass('public.product') is null then
    raise exception 'This project has no product table to copy from.';
  end if;

  -- Every column except the identity/ownership ones, so image URLs, prices,
  -- stock and any other product field travel with the row.
  select string_agg(format('%I', a.attname), ', ' order by a.attnum) into v_cols
  from pg_attribute a
  where a.attrelid = 'public.product'::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attname not in ('id', 'created_date', 'updated_date', 'created_by_id');

  select count(distinct p.created_by_id) into source_shops
  from public.product p
  where p.created_by_id is distinct from v_shop;

  for rec in
    select p.id
    from public.product p
    where p.created_by_id is distinct from v_shop
      and not exists (
        select 1 from public.product_copy_log l
        where l.source_product_id = p.id and l.target_shop = v_shop
      )
    order by p.created_date nulls first, p.id
  loop
    begin
      -- `product.id` has no default, so every copy gets its own 24-character
      -- hex id (the same shape the app generates) instead of the source id.
      execute format(
        'insert into public.product (id, %s, created_by_id)
         select encode(extensions.gen_random_bytes(12), ''hex''), %s, $1
         from public.product where id = $2',
        v_cols, v_cols
      ) using v_shop, rec.id;

      insert into public.product_copy_log (source_product_id, target_shop)
      values (rec.id, v_shop)
      on conflict (source_product_id, target_shop) do nothing;

      copied := copied + 1;
    exception when others then
      failed := failed + 1;
      if jsonb_array_length(errors) < 5 then
        errors := errors || to_jsonb(jsonb_build_object('product_id', rec.id, 'error', sqlerrm));
      end if;
    end;
  end loop;

  select count(*) into already
  from public.product_copy_log
  where target_shop = v_shop;

  return jsonb_build_object(
    'target', lower(btrim(coalesce(p_email, ''))),
    'shop_id', v_shop,
    'source_shops', source_shops,
    'copied', copied,
    'already_copied', already,
    'failed', failed,
    'errors', errors
  );
end $$;

revoke all on function public.admin_copy_products(text) from public;
grant execute on function public.admin_copy_products(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grant Ultra with no expiry and a store allowance
-- ---------------------------------------------------------------------------

create or replace function public.admin_grant_ultra(p_email text, p_max_shops integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop text;
  v_limit integer;
begin
  if not public.is_admin() then
    raise exception 'Only an operator can change a plan.' using errcode = '42501';
  end if;
  if p_max_shops is not null and p_max_shops < 1 then
    raise exception 'The store allowance must be at least 1.';
  end if;

  v_shop := public.shop_owner_id(public.admin_target_shop(p_email));

  insert into public.shop_subscription
    (shop_id, plan, pending_plan, pending_plan_effective_at, current_period_end, max_shops, updated_date)
  values
    (v_shop, 'ultra', null, null, null, p_max_shops, now())
  on conflict (shop_id) do update
    set plan = 'ultra',
        pending_plan = null,
        pending_plan_effective_at = null,
        current_period_end = null,
        max_shops = excluded.max_shops,
        updated_date = now();

  v_limit := public.shop_store_limit(v_shop);

  return jsonb_build_object(
    'target', lower(btrim(coalesce(p_email, ''))),
    'shop_id', v_shop,
    'plan', public.shop_effective_plan(v_shop),
    'max_shops', v_limit,
    'current_period_end', null
  );
end $$;

revoke all on function public.admin_grant_ultra(text, integer) from public;
grant execute on function public.admin_grant_ultra(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Live catalogue and entitlement counts for the operator screen
-- ---------------------------------------------------------------------------

create or replace function public.admin_product_copy_summary(p_email text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_shop text;
begin
  if not public.is_admin() then
    raise exception 'Only an operator can inspect a catalogue.' using errcode = '42501';
  end if;

  v_shop := public.admin_target_shop(p_email);

  return jsonb_build_object(
    'target', lower(btrim(coalesce(p_email, ''))),
    'shop_id', v_shop,
    'plan', public.shop_effective_plan(v_shop),
    'max_shops', public.shop_store_limit(v_shop),
    'shop_count', (select count(*) from public.shop where owner_id = public.shop_owner_id(v_shop)),
    'source_products', (
      select count(*) from public.product p
      where p.created_by_id is distinct from v_shop
    ),
    'copied_already', (
      select count(*) from public.product_copy_log where target_shop = v_shop
    )
  );
end $$;

revoke all on function public.admin_product_copy_summary(text) from public;
grant execute on function public.admin_product_copy_summary(text) to authenticated;
