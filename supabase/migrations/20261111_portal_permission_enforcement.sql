-- Staff portal access rules are enforced, not decorative.
--
-- The owner sets each cashier/supervisor portal to "None", "View" or "Edit" per
-- screen (`set_shop_cashier_permissions`). The shell already hid the screens a
-- portal was not granted, but a portal opened on the store's **own account** met
-- the owner branch of every table policy (`is_shop_owner`), so a view-only
-- portal could still create, change and delete records.
--
-- Now the open staff portal decides what that account may do:
--   * `shop_module_level()` reports the portal's level while a cashier portal
--     session is open (instead of a `shop_member` map), and
--   * the owner bypass is switched off for as long as a cashier portal is open,
--     so the table policies fall back to that portal's rules.
--
-- The owner portal (`method = 'owner'`) and an account with no portal open keep
-- their previous, unrestricted behaviour.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Which portal is open for the caller
-- ---------------------------------------------------------------------------

-- The caller has a cashier/supervisor portal session open on this shop. The
-- session keys on the membership row id for an employee and on the auth uid for
-- the store's own account (see open_cashier_portal_slot), so both are checked.
create or replace function public.shop_cashier_portal_open(p_shop text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_portal_session s
    where s.shop_id = p_shop
      and s.method = 'cashier'
      and s.expires_at > now()
      and (
        s.member_id = auth.uid()::text
        or s.member_id in (
          select m.id from public.shop_member m where m.member_id = auth.uid()::text
        )
      )
  );
$$;

revoke all on function public.shop_cashier_portal_open(text) from public;
grant execute on function public.shop_cashier_portal_open(text) to authenticated;

-- The caller is working inside a staff portal somewhere. Used to switch the
-- owner bypass off for the whole session, so switching branches cannot escape
-- the portal's rules either.
create or replace function public.staff_portal_open()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.shop_portal_session s
    where s.method = 'cashier'
      and s.expires_at > now()
      and (
        s.member_id = auth.uid()::text
        or s.member_id in (
          select m.id from public.shop_member m where m.member_id = auth.uid()::text
        )
      )
  );
$$;

revoke all on function public.staff_portal_open() from public;
grant execute on function public.staff_portal_open() to authenticated;

-- The level the open staff portal grants for these modules: 'edit', 'view' or
-- null when it grants none of them. The shop's plan still caps both.
create or replace function public.shop_cashier_level(p_shop text, p_modules text[])
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.shop_portal_session s
      join public.shop_cashier c on c.id = s.cashier_id
      join lateral jsonb_each_text(c.permissions) perm on true
      where s.shop_id = p_shop
        and s.method = 'cashier'
        and s.expires_at > now()
        and (
          s.member_id = auth.uid()::text
          or s.member_id in (
            select m.id from public.shop_member m where m.member_id = auth.uid()::text
          )
        )
        and perm.key = any(p_modules)
        and perm.value = 'edit'
        and public.shop_plan_level(p_shop, array[perm.key])
    ) then 'edit'
    when exists (
      select 1
      from public.shop_portal_session s
      join public.shop_cashier c on c.id = s.cashier_id
      join lateral jsonb_each_text(c.permissions) perm on true
      where s.shop_id = p_shop
        and s.method = 'cashier'
        and s.expires_at > now()
        and (
          s.member_id = auth.uid()::text
          or s.member_id in (
            select m.id from public.shop_member m where m.member_id = auth.uid()::text
          )
        )
        and perm.key = any(p_modules)
        and perm.value in ('view', 'edit')
        and public.shop_plan_level(p_shop, array[perm.key])
    ) then 'view'
  end;
$$;

revoke all on function public.shop_cashier_level(text, text[]) from public;
grant execute on function public.shop_cashier_level(text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Module level: the open staff portal wins over a membership map
-- ---------------------------------------------------------------------------

create or replace function public.shop_module_level(p_shop text, p_modules text[])
returns text
language sql
security definer
stable
set search_path = public
as $$
  select case
    when public.shop_cashier_portal_open(p_shop)
      then public.shop_cashier_level(p_shop, p_modules)
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

-- The owner branch of the table policies. It is off while a staff portal is
-- open, so that portal's rules — not "I am the owner" — decide the request.
create or replace function public.is_shop_owner_active(p_shop text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_shop_owner(p_shop) and not public.staff_portal_open();
$$;

revoke all on function public.is_shop_owner_active(text) from public;
grant execute on function public.is_shop_owner_active(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Every app table: the owner (no staff portal open, plan covers the module),
-- or the module level the session holds. Re-applies the policy set from
-- 20261030_shop_branches.sql with the portal-aware owner branch.
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
      'using ((public.is_shop_owner_active(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) is not null)',
      r.tbl || '_shop_select', r.tbl, r.read_modules, r.read_modules
    );

    execute format(
      'create policy %I on public.%I for insert to authenticated '
      'with check ((public.is_shop_owner_active(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_insert', r.tbl, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using ((public.is_shop_owner_active(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'') '
      'with check ((public.is_shop_owner_active(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_update', r.tbl, r.write_modules, r.write_modules, r.write_modules, r.write_modules
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated '
      'using ((public.is_shop_owner_active(created_by_id) '
      '  and public.shop_plan_level(created_by_id, %L::text[])) '
      '  or public.shop_module_level(created_by_id, %L::text[]) = ''edit'')',
      r.tbl || '_shop_delete', r.tbl, r.write_modules, r.write_modules
    );
  end loop;
end $$;

-- Settings are never granted to a staff portal, so its open session cannot
-- change them either.
drop policy if exists shop_settings_owner_write on public.shop_settings;
drop policy if exists shop_settings_owner_update on public.shop_settings;
drop policy if exists shop_settings_owner_delete on public.shop_settings;

create policy shop_settings_owner_write on public.shop_settings
  for insert to authenticated
  with check (public.is_shop_owner_active(created_by_id));

create policy shop_settings_owner_update on public.shop_settings
  for update to authenticated
  using (public.is_shop_owner_active(created_by_id))
  with check (public.is_shop_owner_active(created_by_id));

create policy shop_settings_owner_delete on public.shop_settings
  for delete to authenticated
  using (public.is_shop_owner_active(created_by_id));
