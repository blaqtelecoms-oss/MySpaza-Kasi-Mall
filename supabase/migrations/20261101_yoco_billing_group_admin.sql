-- Yoco subscription billing (30-day periods + 7-day grace) and full community
-- group administration.
--
-- A paid plan is no longer switched on from the browser. `set_shop_plan()` now
-- only schedules a move to Free; Premium and Ultra are activated by
-- `apply_subscription_payment()`, which runs with the service role from the API
-- service after Yoco confirms the payment (signed webhook). The paid period is
-- 30 days from the payment; when it lapses the shop keeps its plan for a 7-day
-- grace window and then falls back to Free, enforced here in
-- `shop_effective_plan()` — the function every table policy already consults.
--
-- Community groups (stokvel, savings group, bulk buy) gain a name on the
-- stokvel account and one safe delete function that removes a group together
-- with its open invitations.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Stokvel accounts get a name (a shop may run more than one)
-- ---------------------------------------------------------------------------

alter table public.stockfell_account add column if not exists name text;

-- ---------------------------------------------------------------------------
-- Subscription period columns
-- ---------------------------------------------------------------------------

alter table public.shop_subscription
  add column if not exists period_start timestamptz,
  add column if not exists grace_ends_at timestamptz,
  add column if not exists last_payment_id text,
  add column if not exists payment_provider text;

-- Existing paid rows start a 30-day period (plus a 7-day grace window) so the
-- new expiry rule does not switch anyone off before they can renew.
update public.shop_subscription
set current_period_end = coalesce(current_period_end, coalesce(last_payment_at, created_date) + interval '30 days'),
    period_start = coalesce(period_start, last_payment_at, created_date),
    grace_ends_at = coalesce(
      grace_ends_at,
      coalesce(current_period_end, coalesce(last_payment_at, created_date) + interval '30 days') + interval '7 days'
    )
where plan <> 'free';

-- ---------------------------------------------------------------------------
-- One row per Yoco checkout attempt
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_payment (
  id text primary key,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  shop_id text not null,
  plan text not null check (plan in ('premium', 'ultra')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider text not null default 'yoco',
  provider_checkout_id text unique,
  provider_payment_id text unique,
  redirect_url text,
  paid_at timestamptz,
  failure_reason text,
  created_by_id text
);

create index if not exists subscription_payment_shop_idx
  on public.subscription_payment (shop_id, created_date desc);

alter table public.subscription_payment enable row level security;

drop policy if exists subscription_payment_owner_read on public.subscription_payment;

-- The shop owner sees their own payment history; nothing is written from the
-- browser (the API service uses the service role).
create policy subscription_payment_owner_read on public.subscription_payment
  for select to authenticated
  using (public.is_shop_owner(shop_id));

grant select on public.subscription_payment to authenticated;
revoke all on public.subscription_payment from anon;

-- ---------------------------------------------------------------------------
-- The plan in force: pending change first, then the paid period + 7-day grace
-- ---------------------------------------------------------------------------

create or replace function public.shop_effective_plan(p_shop text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select case
      -- a scheduled change (a downgrade to Free) takes over at its effective date
      when s.pending_plan is not null
        and s.pending_plan_effective_at is not null
        and s.pending_plan_effective_at <= now() then s.pending_plan
      -- an unpaid period keeps the plan for 7 days, then falls back to Free
      when s.plan <> 'free'
        and s.current_period_end is not null
        and now() > s.current_period_end + interval '7 days' then 'free'
      else s.plan
    end
    from public.shop_subscription s
    where s.shop_id = public.shop_owner_id(p_shop)
  ), 'free');
$$;

revoke all on function public.shop_effective_plan(text) from public;
grant execute on function public.shop_effective_plan(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Billing details for the app: plan, dates and where the period stands
-- ---------------------------------------------------------------------------

create or replace function public.shop_billing(p_shop text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select case
    when not (public.is_shop_owner(p_shop) or public.is_shop_member(p_shop)) then null
    else (
      select jsonb_build_object(
        'plan', public.shop_effective_plan(p_shop),
        'stored_plan', coalesce(sub.plan, 'free'),
        'pending_plan', sub.pending_plan,
        'pending_plan_effective_at', sub.pending_plan_effective_at,
        'period_start', sub.period_start,
        'current_period_end', sub.current_period_end,
        'grace_ends_at', sub.grace_ends_at,
        'last_payment_at', sub.last_payment_at,
        'payment_status', case
          when coalesce(sub.plan, 'free') = 'free' then 'free'
          when public.shop_effective_plan(p_shop) = 'free' then 'expired'
          when sub.current_period_end is null then 'active'
          when now() <= sub.current_period_end then 'active'
          when sub.grace_ends_at is not null and now() <= sub.grace_ends_at then 'grace'
          else 'expired'
        end
      )
      from (select 1) one
      left join public.shop_subscription sub
        on sub.shop_id = public.shop_owner_id(p_shop)
    )
  end;
$$;

revoke all on function public.shop_billing(text) from public;
grant execute on function public.shop_billing(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The browser may only schedule a move to Free. Paid plans are activated by a
-- confirmed Yoco payment, never by this function.
-- ---------------------------------------------------------------------------

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
  if p_plan <> 'free' then
    raise exception 'Paid plans are activated when Yoco confirms your payment.';
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

  if active_plan = 'free' then
    update public.shop_subscription
    set plan = 'free',
        period_start = null,
        current_period_end = null,
        grace_ends_at = null,
        pending_plan = null,
        pending_plan_effective_at = null,
        updated_date = now()
    where shop_id = uid;
  else
    -- Keep the paid features until the period the owner already paid for ends.
    update public.shop_subscription
    set plan = active_plan,
        period_start = coalesce(sub.period_start, sub.last_payment_at, sub.created_date),
        current_period_end = coalesce(period_end, now()),
        grace_ends_at = coalesce(period_end, now()) + interval '7 days',
        pending_plan = 'free',
        pending_plan_effective_at = coalesce(period_end, now()),
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

-- ---------------------------------------------------------------------------
-- Payment settlement (service role only — called by the API service after a
-- signed Yoco webhook)
-- ---------------------------------------------------------------------------

-- Marks a checkout as paid and starts a fresh 30-day period. Idempotent: a
-- retried or duplicated webhook returns the settled state without extending.
create or replace function public.apply_subscription_payment(
  p_payment_id text,
  p_provider_payment_id text,
  p_amount_cents integer,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.subscription_payment;
  sub public.shop_subscription;
  paid_time timestamptz := coalesce(p_paid_at, now());
  new_end timestamptz;
begin
  select * into pay from public.subscription_payment where id = p_payment_id for update;
  if not found then
    raise exception 'Unknown payment.';
  end if;

  if pay.status = 'paid' then
    return jsonb_build_object(
      'status', 'paid', 'already', true,
      'shop_id', pay.shop_id, 'plan', pay.plan,
      'current_period_end', (select current_period_end from public.shop_subscription where shop_id = pay.shop_id)
    );
  end if;

  if p_amount_cents is not null and p_amount_cents <> pay.amount_cents then
    raise exception 'Payment amount does not match the checkout (%, expected %).',
      p_amount_cents, pay.amount_cents;
  end if;

  -- The same Yoco payment can only settle one row.
  if p_provider_payment_id is not null and exists (
    select 1 from public.subscription_payment p
    where p.provider_payment_id = p_provider_payment_id and p.id <> pay.id
  ) then
    return jsonb_build_object('status', 'paid', 'already', true, 'duplicate', true);
  end if;

  new_end := paid_time + interval '30 days';

  update public.subscription_payment
  set status = 'paid',
      provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
      paid_at = paid_time,
      failure_reason = null,
      updated_date = now()
  where id = pay.id;

  insert into public.shop_subscription (shop_id)
  values (pay.shop_id)
  on conflict (shop_id) do nothing;

  select * into sub from public.shop_subscription where shop_id = pay.shop_id for update;

  -- A late event for an older checkout must not shorten a newer period.
  if sub.last_payment_at is not null
    and sub.last_payment_at > paid_time
    and sub.current_period_end is not null
    and sub.current_period_end > new_end then
    return jsonb_build_object(
      'status', 'paid', 'already', true, 'stale', true,
      'shop_id', pay.shop_id, 'plan', sub.plan,
      'current_period_end', sub.current_period_end
    );
  end if;

  update public.shop_subscription
  set plan = pay.plan,
      period_start = paid_time,
      current_period_end = new_end,
      grace_ends_at = new_end + interval '7 days',
      pending_plan = null,
      pending_plan_effective_at = null,
      last_payment_at = paid_time,
      last_payment_id = pay.id,
      payment_provider = 'yoco',
      updated_date = now()
  where shop_id = pay.shop_id;

  return jsonb_build_object(
    'status', 'paid',
    'already', false,
    'shop_id', pay.shop_id,
    'plan', pay.plan,
    'period_start', paid_time,
    'current_period_end', new_end,
    'grace_ends_at', new_end + interval '7 days'
  );
end $$;

revoke all on function public.apply_subscription_payment(text, text, integer, timestamptz) from public;
revoke all on function public.apply_subscription_payment(text, text, integer, timestamptz) from authenticated;
grant execute on function public.apply_subscription_payment(text, text, integer, timestamptz) to service_role;

create or replace function public.mark_subscription_payment_failed(
  p_payment_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.subscription_payment;
begin
  select * into pay from public.subscription_payment where id = p_payment_id for update;
  if not found then
    raise exception 'Unknown payment.';
  end if;

  -- A payment that already succeeded is never undone by a late failure event.
  if pay.status = 'paid' then
    return jsonb_build_object('status', 'paid', 'ignored', true);
  end if;

  update public.subscription_payment
  set status = 'failed',
      failure_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      updated_date = now()
  where id = pay.id;

  return jsonb_build_object('status', 'failed', 'shop_id', pay.shop_id, 'plan', pay.plan);
end $$;

revoke all on function public.mark_subscription_payment_failed(text, text) from public;
revoke all on function public.mark_subscription_payment_failed(text, text) from authenticated;
grant execute on function public.mark_subscription_payment_failed(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Community group removal: the group and its open invitations go together
-- ---------------------------------------------------------------------------

create or replace function public.delete_community_group(p_kind text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  v_table text;
  v_owner text;
begin
  if uid is null then
    raise exception 'Sign in to manage your groups.' using errcode = '28000';
  end if;

  v_table := case p_kind
    when 'stokvel' then 'stockfell_account'
    when 'savings_group' then 'savings_group'
    when 'bulk_buy' then 'bulk_buy'
  end;
  if v_table is null then
    raise exception 'Unknown group type.';
  end if;

  execute format('select created_by_id from public.%I where id = $1', v_table)
    into v_owner using p_id;

  if v_owner is null then
    raise exception 'That group no longer exists.';
  end if;
  if not public.is_shop_owner(v_owner) then
    raise exception 'Only the shop owner can delete this group.';
  end if;

  -- Pending invitations would keep pointing at a group that is gone.
  delete from public.group_invite
  where group_kind = p_kind
    and group_id = p_id
    and shop_id = v_owner;

  execute format('delete from public.%I where id = $1', v_table) using p_id;

  return jsonb_build_object('deleted', p_id, 'group_kind', p_kind);
end $$;

revoke all on function public.delete_community_group(text, text) from public;
grant execute on function public.delete_community_group(text, text) to authenticated;
