-- Resend delivery events for the operator email log.
--
-- Rows are written by the server-side email service (server/) with the service
-- role key, which bypasses row level security. Operators read the log in the
-- app ("Email Log" in the sidebar), so the only policy here is an admin-only
-- select. There is deliberately no insert/update/delete policy for app users.
--
-- `provider_event_id` is the Resend/Svix message id: the unique constraint makes
-- retried webhook deliveries and repeated signup submissions idempotent.
-- Verification codes are never stored in this table.
--
-- Applied to the app's Supabase project; safe to re-run.

create table if not exists public.email_event (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  provider_event_id text not null unique,
  event_type text not null,
  resend_email_id text,
  recipient_email text,
  sender_email text,
  subject text,
  template text,
  event_created_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists email_event_created_date_idx
  on public.email_event (created_date desc);

create index if not exists email_event_resend_email_id_idx
  on public.email_event (resend_email_id);

alter table public.email_event enable row level security;

drop policy if exists email_event_admin_read on public.email_event;
create policy email_event_admin_read on public.email_event
  for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
