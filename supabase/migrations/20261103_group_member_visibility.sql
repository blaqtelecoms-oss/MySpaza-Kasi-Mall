-- Invited members can see the group they joined.
-- ---------------------------------------------------------------------------
-- A stokvel, savings group or bulk buy is one row owned by the shop that
-- started it (`created_by_id`), so the owner and that shop's employees see it
-- through the existing policies. A person who accepts an invitation is neither
-- — their address is only in the row's `members` array — so the shop-scoped
-- read hid the group from them.
--
-- `my_group_memberships()` answers exactly one question: "which of these groups
-- carry the signed-in address in their member list?". It is security definer
-- because the caller cannot read another shop's row through RLS, and it filters
-- on the caller's own address, so it can never return a group they were not
-- invited to. Row level security itself is untouched: members still cannot read
-- or write these tables directly, and writes stay owner/employee only.

create or replace function public.jsonb_has_member_email(p_members jsonb, p_email text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_members, '[]'::jsonb)) member
    where lower(coalesce(member ->> 'email', '')) = lower(coalesce(p_email, ''))
      and coalesce(member ->> 'email', '') <> ''
  );
$$;

revoke all on function public.jsonb_has_member_email(jsonb, text) from public;

-- Returns the rows of one group kind the signed-in address is a member of.
create or replace function public.my_group_memberships(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := lower(btrim(coalesce(p_kind, '')));
  email text;
  rows jsonb;
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  select lower(u.email) into email from auth.users u where u.id = auth.uid();
  if email is null then
    return '[]'::jsonb;
  end if;

  if kind = 'stokvel' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into rows
    from public.stockfell_account t
    where public.jsonb_has_member_email(t.members, email);

  elsif kind = 'savings_group' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into rows
    from public.savings_group t
    where public.jsonb_has_member_email(t.members, email);

  elsif kind = 'bulk_buy' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into rows
    from public.bulk_buy t
    where public.jsonb_has_member_email(t.members, email);

  else
    raise exception 'Unknown group kind: %', p_kind;
  end if;

  return coalesce(rows, '[]'::jsonb);
end;
$$;

revoke all on function public.my_group_memberships(text) from public;
grant execute on function public.my_group_memberships(text) to authenticated;
