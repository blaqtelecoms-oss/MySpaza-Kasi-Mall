-- Customers is a Free-plan screen now.
--
-- The matrix here must stay in step with FEATURES in src/lib/plans.js: moving
-- `customers` to the Free tier in the UI only removes the paywall, while the
-- `customer` table policy still asks shop_plan_level(), so the database has to
-- allow the module on Free too or the screen renders with no rows.

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
        'calculators', 'funding', 'myspaza_card', 'expenses', 'suppliers', 'ads',
        'employees', 'customers'
      ])
    )
  end;
$$;

revoke all on function public.shop_plan_level(text, text[]) from public;
grant execute on function public.shop_plan_level(text, text[]) to authenticated;
