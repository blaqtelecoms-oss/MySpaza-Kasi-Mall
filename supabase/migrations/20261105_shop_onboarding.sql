-- First-run onboarding.
--
-- `profiles.onboarded_at` records that the account has been through the welcome
-- flow: the business profile, then a plan choice (Free, Premium or Ultra). It
-- sits on the profile because onboarding belongs to the account, not to a shop
-- or branch, and the profile row already exists for every account.
--
-- Accounts that existed before this shipped are grandfathered: their shop is
-- already running, so they must never be pushed through the flow (and must never
-- be nudged into a plan change they did not ask for).
--
-- `auth.users.created_at` is the account's real age, so re-running this never
-- stamps an account created after the cut-off.
--
-- Applied to the app's Supabase project; safe to re-run.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

update public.profiles p
set onboarded_at = now()
from auth.users u
where u.id = p.id
  and p.onboarded_at is null
  and u.created_at < timestamptz '2026-10-30 12:00:00+02';
