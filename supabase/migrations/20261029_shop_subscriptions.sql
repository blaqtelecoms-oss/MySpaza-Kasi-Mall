-- Subscription plans and feature gating.
--
-- A plan belongs to the shop (the owner's account), so every employee works
-- under the owner's plan. It is stored here rather than in the browser, and the
-- helper every table policy already calls (`shop_module_level`) now also
-- requires the plan to cover the module — so a Free shop cannot reach Ultra data
-- through a crafted API call, and the menu is only a mirror of this rule.
--
--   Free    : dashboard, POS, Inventory, Cash Up, Daily Sales, Academy,
--             Calculators, Funding Hub, MySpaza Card, Expenses, Suppliers, Ads
--   Premium : Free + Employees, Reports, Spaza Coach, Customers
--   Ultra   : everything (adds Debtors Control, Accounting, Banking)
--
-- A downgrade never removes access mid-period: it is stored as `pending_plan`
-- and takes over at `pending_plan_effective_at` (the end of the paid period).
--
-- Safe to re-run.

create table if not exists public.shop_subscription (
  shop_id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  plan text not null default 'free' check (plan in ('free', 'premium', 'ultra')),
  current_period_end timestamptz,
  pending_plan text check (pending_plan in ('free', 'premium', 'ultra')),
  pending_plan_effective_at timestamptz,
  last_payment_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Plan helpers
-- ---------------------------------------------------------------------------

create or replace function public.plan_rank(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan when 'ultra' then 2 when 'premium' then 1 else 0 end;
$$;

-- The plan in force right now: a scheduled downgrade only takes over once its
-- effective date has passed.
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
    where s.shop_id = p_shop
  ), 'free');
$$;

-- Does the shop's plan cover any of these modules?
create or replace function public.shop_plan_level(p_shop text, p_modules text[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case public.shop_effective_plan(p_shop)
    when 'ultra' then true
    when 'premium' then exists (
      select 1
      from unnest(p_modules) m
      where m <> all (array['debtors', 'accounting', 'banking'])
    )
    else exists (
      select 1
      from unnest(p_modules) m
      where m = any (array[
        'dashboard', 'pos', 'inventory', 'cashup', 'daily_sales', 'academy',
        'calculators', 'funding', 'myspaza_card', 'expenses', 'suppliers', 'ads'
      ])
    )
  end;
$$;

revoke all on function public.shop_effective_plan(text) from public;
grant execute on function public.shop_effective_plan(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Employee module permissions now also need the plan to include the module
-- ---------------------------------------------------------------------------

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
    ) then 'view'
  end;
$$;

revoke all on function public.shop_module_level(text, text[]) from public;
grant execute on function public.shop_module_level(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Every app table: the owner (on a plan that covers the module), or an
-- employee holding the module. Re-applies the same policy set as
-- 20261028_shop_employees.sql with the plan check added.
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
      'using ((created_by_id = auth.uid()::text '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) is not null)',
      r.tbl || '_shop_select', r.tbl, r.read_modules, r.read_modules
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check ((created_by_id = auth.uid()::text '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_insert', r.tbl, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using ((created_by_id = auth.uid()::text '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'') '
      'with check ((created_by_id = auth.uid()::text '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_update', r.tbl, r.write_modules, r.write_modules, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using ((created_by_id = auth.uid()::text '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_delete', r.tbl, r.write_modules, r.write_modules
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- The subscription row: readable by the shop's owner and employees, written
-- only through the function below.
-- ---------------------------------------------------------------------------

alter table public.shop_subscription enable row level security;

drop policy if exists shop_subscription_read on public.shop_subscription;

create policy shop_subscription_read on public.shop_subscription
  for select to authenticated
  using (shop_id = auth.uid()::text or public.is_shop_member(shop_id));

grant select on public.shop_subscription to authenticated;
revoke all on public.shop_subscription from anon;

-- Owner changes the plan. An upgrade applies immediately and starts a fresh
-- period; a downgrade is scheduled for the end of the current period.
create or replace function public.set_shop_plan(p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  sub public.shop_subscription;
  active_plan text;
  period_end timestamptz;
  result jsonb;
begin
  if uid is null then
    raise exception 'Sign in to change your plan.' using errcode = '28000';
  end if;
  if p_plan is null or p_plan not in ('free', 'premium', 'ultra') then
    raise exception 'Unknown plan.';
  end if;
  if exists (
    select 1 from public.shop_member m
    where m.member_id = uid and m.status = 'active'
  ) then
    raise exception 'Only the shop owner can change the subscription.';
  end if;

  insert into public.shop_subscription (shop_id)
  values (uid)
  on conflict (shop_id) do nothing;

  select * into sub from public.shop_subscription where shop_id = uid;
  active_plan := public.shop_effective_plan(uid);
  period_end := sub.current_period_end;

  if public.plan_rank(p_plan) > public.plan_rank(active_plan) then
    -- Upgrade: unlocked immediately, with a fresh month from today.
    update public.shop_subscription
    set plan = p_plan,
        current_period_end = now() + interval '1 month',
        pending_plan = null,
        pending_plan_effective_at = null,
        last_payment_at = now(),
        updated_date = now()
    where shop_id = uid;
  elsif public.plan_rank(p_plan) = public.plan_rank(active_plan) then
    update public.shop_subscription
    set plan = active_plan,
        pending_plan = null,
        pending_plan_effective_at = null,
        updated_date = now()
    where shop_id = uid;
  else
    -- Downgrade: keep access until the paid period ends.
    update public.shop_subscription
    set plan = active_plan,
        current_period_end = coalesce(period_end, now() + interval '1 month'),
        pending_plan = p_plan,
        pending_plan_effective_at = coalesce(period_end, now() + interval '1 month'),
        updated_date = now()
    where shop_id = uid;
  end if;

  select jsonb_build_object(
    'shop_id', s.shop_id,
    'plan', public.shop_effective_plan(s.shop_id),
    'stored_plan', s.plan,
    'pending_plan', s.pending_plan,
    'pending_plan_effective_at', s.pending_plan_effective_at,
    'current_period_end', s.current_period_end
  )
  into result
  from public.shop_subscription s
  where s.shop_id = uid;

  return result;
end $$;

revoke all on function public.set_shop_plan(text) from public;
grant execute on function public.set_shop_plan(text) to authenticated;
