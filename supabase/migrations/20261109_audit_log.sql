-- The store's audit log: everything that happens in the shop, and who did it.
--
-- One row per event, written by the database itself so a screen cannot fake or
-- skip it: data changes come from a trigger on the shop's tables, while
-- sign-ins, sign-outs, portal opens and page views arrive through
-- `log_audit_event()` (which stamps the actor from the session, never from the
-- browser's payload). The audit log is readable by the shop owner only.
--
-- Safe to re-run.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id text primary key default replace(extensions.gen_random_uuid()::text, '-', ''),
  -- The shop the event belongs to, and the column every audit read is scoped by.
  created_by_id text not null default auth.uid()::text,
  created_date timestamptz not null default now(),
  actor_id text,
  actor_name text,
  actor_role text,
  -- Which portal the person had open: owner, cashier or supervisor.
  portal text,
  -- auth | portal | page | data
  category text not null default 'data',
  -- sign_in, sign_out, portal_open, portal_close, page_view, insert …
  action text not null,
  module text,
  path text,
  summary text,
  entity text,
  entity_id text,
  details jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_shop_date_idx
  on public.audit_log (created_by_id, created_date desc);

create index if not exists audit_log_shop_category_idx
  on public.audit_log (created_by_id, category, created_date desc);

alter table public.audit_log enable row level security;

-- The owner reads the log. Nobody writes it directly: the trigger below and
-- `log_audit_event()` run as the definer, so a store's log cannot be edited or
-- deleted from a browser, not even by the owner.
drop policy if exists audit_log_owner_read on public.audit_log;
create policy audit_log_owner_read on public.audit_log
  for select to authenticated
  using (public.is_shop_owner(created_by_id));

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Who is acting: the signed-in account, the shop role it holds, and the portal
-- it has open (a cashier portal on the store's own account is "cashier").
-- ---------------------------------------------------------------------------

create or replace function public.audit_actor(p_shop text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_owner boolean := false;
  v_member_role text;
  v_member_name text;
  v_profile record;
  v_session jsonb := public.current_portal_session();
begin
  select public.is_shop_owner(p_shop) into v_owner;

  select m.role, coalesce(m.full_name, m.member_email)
    into v_member_role, v_member_name
  from public.shop_member m
  where m.shop_id = p_shop
    and m.member_id = v_uid
    and m.status = 'active'
  limit 1;

  select p.full_name, p.email into v_profile
  from public.profiles p
  where p.id = auth.uid();

  return jsonb_build_object(
    'actor_id', v_uid,
    'actor_name',
      coalesce(
        nullif(v_session->>'cashier_name', ''),
        nullif(v_member_name, ''),
        nullif(v_profile.full_name, ''),
        v_profile.email,
        'Unknown'
      ),
    'actor_role',
      case when v_owner then 'Owner' else coalesce(v_member_role, 'Staff') end,
    'portal',
      case
        when v_session->>'method' = 'owner' then 'owner'
        when v_session->>'method' = 'cashier' then coalesce(v_session->>'cashier_role', 'cashier')
        when v_owner then 'owner'
        else null
      end
  );
end $$;

revoke all on function public.audit_actor(text) from public;
grant execute on function public.audit_actor(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sign-ins, sign-outs, portal opens and page access
-- ---------------------------------------------------------------------------

create or replace function public.log_audit_event(
  p_shop text,
  p_category text,
  p_action text,
  p_module text default null,
  p_path text default null,
  p_summary text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor jsonb;
  v_id text;
begin
  -- A signed-out browser (or a background refresh) has nothing to record.
  if auth.uid() is null then
    return null;
  end if;

  if not (public.is_shop_owner(p_shop) or public.is_shop_member(p_shop)) then
    raise exception 'This account does not work in that store.' using errcode = '42501';
  end if;

  if p_category not in ('auth', 'portal', 'page', 'data') then
    raise exception 'Unknown audit category.' using errcode = '22023';
  end if;

  -- The same event reported twice in a row (a re-render, a double effect) is
  -- one entry, not two.
  if exists (
    select 1
    from public.audit_log a
    where a.created_by_id = p_shop
      and a.actor_id = auth.uid()::text
      and a.action = p_action
      and a.path is not distinct from p_path
      and a.module is not distinct from p_module
      and a.created_date > now() - interval '3 seconds'
  ) then
    return null;
  end if;

  v_actor := public.audit_actor(p_shop);

  insert into public.audit_log (
    created_by_id, actor_id, actor_name, actor_role, portal,
    category, action, module, path, summary, details
  )
  values (
    p_shop, v_actor->>'actor_id', v_actor->>'actor_name', v_actor->>'actor_role',
    v_actor->>'portal', p_category, p_action, p_module, p_path, p_summary,
    coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end $$;

revoke all on function public.log_audit_event(text, text, text, text, text, text, jsonb) from public;
grant execute on function public.log_audit_event(text, text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Data changes: every add, edit and delete on the shop's tables
-- ---------------------------------------------------------------------------

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_row jsonb;
  v_shop text;
  v_actor jsonb;
  v_label text;
  v_changed text;
begin
  -- Writes with no signed-in person behind them (migrations, the service role)
  -- belong to no one, so they are not attributed to anybody.
  if auth.uid() is null then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_row := v_old;
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
  end if;

  v_shop := nullif(coalesce(v_row->>'created_by_id', v_row->>'shop_id'), '');
  if v_shop is null then
    return null;
  end if;
  if not (public.is_shop_owner(v_shop) or public.is_shop_member(v_shop)) then
    return null;
  end if;

  v_label := coalesce(
    nullif(v_row->>'full_name', ''),
    nullif(v_row->>'name', ''),
    nullif(v_row->>'title', ''),
    nullif(v_row->>'reference', '')
  );

  if tg_op = 'UPDATE' then
    select string_agg(key, ', ' order by key) into v_changed
    from jsonb_each(v_new)
    where v_old->key is distinct from v_new->key
      and key not in ('updated_date');
  end if;

  v_actor := public.audit_actor(v_shop);

  -- Logging must never break the change it records.
  begin
    insert into public.audit_log (
      created_by_id, actor_id, actor_name, actor_role, portal,
      category, action, module, summary, entity, entity_id, details
    )
    values (
      v_shop,
      v_actor->>'actor_id',
      v_actor->>'actor_name',
      v_actor->>'actor_role',
      v_actor->>'portal',
      'data',
      lower(tg_op),
      null,
      initcap(replace(tg_table_name, '_', ' ')) || ' ' || lower(tg_op)
        || coalesce(': ' || v_label, ''),
      tg_table_name,
      v_row->>'id',
      jsonb_strip_nulls(jsonb_build_object('fields', v_changed))
    );
  exception when others then
    null;
  end;

  return null;
end $$;

revoke all on function public.audit_row_change() from public;

-- Attach the trigger to the shop's data tables. Re-running replaces them.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'bank_account', 'bulk_buy', 'cash_up', 'customer', 'expense', 'product',
    'purchase_order', 'sale', 'savings_group', 'shop_cashier', 'shop_member',
    'shop_settings', 'stock_adjustment', 'stockfell_account',
    'subscription_payment', 'supplier', 'wholesaler', 'wholesaler_discount'
  ]
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = v_table and table_type = 'BASE TABLE'
    ) then
      execute format('drop trigger if exists audit_row_change on public.%I', v_table);
      execute format(
        'create trigger audit_row_change after insert or update or delete on public.%I '
        'for each row execute function public.audit_row_change()',
        v_table
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Staff allowance: Employees is on every plan, so keep the plan matrix (this
-- copy and src/lib/plans.js) in step, and clear the unused default supervisor
-- slot a store ran before the plan decided its staff.
-- ---------------------------------------------------------------------------

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
        'employees'
      ])
    )
  end;
$$;

revoke all on function public.shop_plan_level(text, text[]) from public;
grant execute on function public.shop_plan_level(text, text[]) to authenticated;

-- A default-named portal nobody has set a password for is a slot, not a person,
-- so it goes when the plan does not cover it. A portal with a password or a
-- name the owner chose is never removed.
with ranked as (
  select c.id,
         row_number() over (partition by c.shop_id, c.role order by c.slot) as rn,
         public.shop_staff_limit(c.shop_id, c.role) as lim
  from public.shop_cashier c
  where (
      (c.role = 'cashier' and c.full_name ~ '^Cashier [0-9]+$')
      or (c.role = 'supervisor' and c.full_name = 'Supervisor')
    )
    and not exists (
      select 1 from public.shop_cashier_secret x where x.cashier_id = c.id
    )
)
delete from public.shop_cashier
 where id in (select id from ranked where lim is not null and rn > lim);
