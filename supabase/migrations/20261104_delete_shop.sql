-- Removing a shop or branch.
--
-- A branch is a `public.shop` row owned by the account, and its records are the
-- rows whose `created_by_id` is that branch id (see 20261030_shop_branches.sql).
-- `public.delete_shop()` lets the owner remove one branch with everything that
-- belongs to it. The primary shop is refused: that row is the account itself,
-- so removing it is the account deletion in Settings → Security.
--
-- Only the owner may call it, and the function is `security definer` so the
-- branch's rows can be cleared without widening any table policy.
--
-- Safe to re-run.

create or replace function public.delete_shop(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := auth.uid()::text;
  target public.shop;
  tbl text;
begin
  if uid is null then
    raise exception 'Sign in to remove a shop.' using errcode = '28000';
  end if;

  -- The primary shop carries the owner's own id; there is nothing to delete
  -- beyond the account, which has its own flow.
  if p_id is null or p_id = uid then
    raise exception 'Your main shop is your account, so it cannot be removed here. Delete the account from Settings → Security instead.';
  end if;

  if not public.is_shop_owner(p_id) then
    raise exception 'Only the shop owner can remove a shop.';
  end if;

  select * into target from public.shop where id = p_id;
  if not found then
    raise exception 'That shop no longer exists.';
  end if;
  if target.is_primary then
    raise exception 'Your main shop is your account, so it cannot be removed here. Delete the account from Settings → Security instead.';
  end if;

  -- Team access and open invitations for the branch go with it.
  delete from public.shop_member where shop_id = p_id;
  if to_regclass('public.shop_invite') is not null then
    delete from public.shop_invite where shop_id = p_id;
  end if;

  -- The branch's own records. Only tables this project actually has are
  -- touched, so a partially migrated project still deletes cleanly.
  for tbl in
    select t.name
    from (values
      ('product'), ('sale'), ('cash_up'), ('expense'), ('customer'),
      ('supplier'), ('bank_account'), ('purchase_order'), ('stock_adjustment'),
      ('bulk_buy'), ('savings_group'), ('stockfell_account'), ('wholesaler'),
      ('wholesaler_discount'), ('shop_settings')
    ) as t(name)
    where to_regclass('public.' || t.name) is not null
  loop
    execute format('delete from public.%I where created_by_id = $1', tbl) using p_id;
  end loop;

  delete from public.shop where id = p_id;

  return jsonb_build_object('id', p_id, 'name', target.name);
end $$;

revoke all on function public.delete_shop(text) from public;
grant execute on function public.delete_shop(text) to authenticated;
