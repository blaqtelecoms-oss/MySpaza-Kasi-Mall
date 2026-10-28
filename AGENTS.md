# AGENTS.md

## Project Context

My Spaza is a React + Vite single-page shop-management app. Data, media and
user accounts live in **Supabase** (Postgres, Auth, Storage). Keep changes
focused on the user's request and preserve existing project conventions.

See `README.md` for local setup, environment variables and the Supabase schema.

## Key Files

- `src/`: frontend application source.
- `src/api/supabase.js`: Supabase browser client (URL + anon/publishable key).
- `src/api/client.js`: the app's data/auth API — entity methods (`list`,
  `filter`, `get`, `create`, `update`, `delete`, bulk forms) map to snake_case
  Postgres tables, plus `auth` (Supabase Auth) and
  `integrations.Core.UploadPublicFile` (Supabase Storage, `inventory-media`).
- `src/lib/AuthContext.jsx`: session/profile state for the whole app.
- `src/lib/offlineLayer.js` + `offlineStorage/offlineQueue/syncEngine`: offline
  cache and write queue wrapped around `client.entities`.
- `server/`: zero-dependency Node email service (Resend sends + delivery
  webhook). Runs as the `api` compose service on host port `8000`.
- `public/brand/auth-bg.jpg`: sign-in hero photo (grocery shelves), CC0 from
  Wikimedia Commons ("Grocery Outlet - September 2024" by Sarah Stierch).
- `src/pages/EmailEvents.jsx`: operator-only Resend event log at
  `/admin/email-events` ("Email Log" in the sidebar, `role = 'admin'` only).
- `supabase/migrations/`: SQL policies applied to the Supabase project.
- `docker-compose.base44.yml`: sandbox runtime (file name is required by the
  platform; the app itself has no Base44 dependency).

## Working Notes

- Screens import the API as `import { api } from "@/api/client"`.
- Entity method signatures mirror the previous data layer:
  `list(sort, limit)`, `filter(criteria, sort, limit)`, `get(id)`,
  `create(data)`, `update(id, data)`, `delete(id)`. A sort of `"-field"` is
  newest-first; the default is `-created_date`. Sorting by a column a table does
  not have falls back to `-created_date` instead of failing.
- Row level security is the access control: every app table is owned by the
  signed-in user (`created_by_id = auth.uid()`), so one account never sees
  another's records. Never weaken a policy to make a screen work.
- `public.profiles` mirrors each auth user (`id`, `email`, `full_name`,
  `role`). A missing profile is created on first sign-in.
- Run `npm run lint` and `npm run build` before finishing a change.

## Data ownership (multi-tenant)

`supabase/migrations/20261028_user_owned_data.sql` applies the isolation model;
re-run it after a schema change.

- Every app table has one policy, `<table>_owner_all`, for `authenticated`:
  `using (created_by_id = auth.uid()::text)` and the same `with check`. A new
  account therefore starts with an empty workspace, and rows with no
  identifiable owner (`created_by_id is null`, or the imported `service_…`
  account) are invisible to everyone — they are kept, not deleted.
- `created_by_id` defaults to `auth.uid()::text`, and `client.js` always stamps
  it from the session, never from the payload. Writing someone else's id gets a
  403 from the policy.
- `profiles`: a user reads and edits only their own row; `is_admin()` sees all.
  A trigger (`profiles_guard_role`) silently keeps `role` unchanged unless the
  caller is already an admin, so nobody can promote themselves.
- `email_event` and `media_assets` are operator-only (`is_admin()`). The
  `inventory-media` bucket stays public, so product photos keep working.
- Storage uploads are filed under a folder named after the owner's auth id
  (`client.js` → `UploadPublicFile`), because the write policies scope inserts
  to `(storage.foldername(name))[1] = auth.uid()::text`.
- `public.shop_settings` (migration `20261028_shop_logo_and_settings.sql`) keeps
  one row per account (`unique created_by_id`) holding `business` and `receipt`
  jsonb blobs plus `logo_url`; the Settings screen and the POS receipt read the
  same row. The shop logo goes to the public `shop-logos` bucket (see
  `src/lib/shopSettings.js`), so the printed receipt can load it.
- Imported rows carry the old 24-character user id; the migration maps them to
  the account's auth id through `profiles.base44_id` so owners keep their data.
- Device caches (`src/lib/userDataReset.js`) are wiped whenever the signed-in
  identity changes, so an offline cache or queued write can never leak between
  accounts on a shared browser.

## Sandbox runtime (`docker-compose.base44.yml`)

`docker compose -f docker-compose.base44.yml up -d` runs two services.

`app` (host port `3000`):

- Node 22 running `npm install && npm run dev` (Vite) from the bind-mounted
  checkout, so edits hot-reload. Host port `3000` maps to Vite's `:5173`.
- Supabase credentials come from the platform env file `/run/base44/app.env`
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). They are never committed.
- `BASE44_PREVIEW_MODE=1` makes `vite.config.js` bind the dev server to
  `0.0.0.0` and accept the preview host (`.<BASE44_SANDBOX_HOST_DOMAIN>`, e.g.
  `3000-<sandbox id>.e2b.app`) so the preview proxy can reach it. Unset,
  `npm run dev` keeps its default localhost binding and host checks.
- The app talks to Supabase directly from the browser; the only local backend
  is the email service.

`api` (host port `8000`, in-container `8080`):

- Runs `node server/index.js` with no install step and no `depends_on`. Its
  healthcheck hits
  `/health`, which reports whether Resend and the Supabase writer are configured
  — a 200 with `resend: false` means a secret is missing, not that the service is
  down.
- Webhooks are called by third parties, so they target the api service's own
  port host, `https://8000-$BASE44_PUBLIC_HOST_SUFFIX/api/...`, not the Vite
  dev server.

## Supabase auth settings (project-level, not in this repo)

- `site_url` is `https://myspaza-app.co.za`; `uri_allow_list` must contain the
  production domain, the sandbox preview origin
  (`https://*.imported.base44-preview.app/**`) and `http://localhost:3000/**`.
  Supabase silently swaps a non-allowlisted `redirect_to` for `site_url`, so a
  stale allowlist sends Google sign-in and email links to the wrong host instead
  of failing loudly.
- `mailer_otp_length` must stay **6**: the signup screen (`Register.jsx`) has six
  OTP boxes, so an 8-digit project setting makes every emailed code impossible to
  enter ("Token has expired or is invalid"). Emails carry the code Supabase
  generates, so the project setting — not the email template — decides the length.
- Google auth is enabled; the Google Cloud OAuth client needs
  `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
  URI. The client id/secret live only in Supabase, never in this repo.

## Email (Resend)

- `POST /api/hooks/supabase/send-email` is Supabase's *Send Email* auth hook: it
  renders the verification code and sends it with Resend from
  `noreply@myspaza-app.co.za`. Supabase needs the hook enabled with the endpoint
  and secret in the dashboard; until then Supabase sends its own auth emails and
  the app still works (the signup OTP flow is unchanged either way).
- Supabase still enforces its own auth-email send rate limit
  (`rate_limit_email_sent`) *before* calling the hook, so a low value returns
  "email rate limit exceeded" even though the hook works. It is a per-project
  setting (Auth → Rate Limits, or `PATCH /v1/projects/{ref}/config/auth`); this
  project runs at 200 per hour (Resend's plan limits still apply below it).
- The hook URI points at the sandbox host `https://8000-$BASE44_PUBLIC_HOST_SUFFIX/...`,
  so it must be pointed at the real domain on deploy (and re-pointed if the
  sandbox is recreated).
- `POST /api/webhooks/resend` stores every Resend event in `public.email_event`.
  `provider_event_id` (the Svix message id) is unique, so retries are idempotent.
- Both routes verify the Standard Webhooks HMAC over the raw body
  (`server/lib/webhook-signature.js`) and answer 503 when the matching secret is
  missing, 401 when the signature is wrong.
- Never log request bodies or email tokens: they carry verification codes.
- Verify the service without the real secrets by running a second instance with
  throwaway ones, e.g. inside the container:
  `PORT=8099 RESEND_WEBHOOK_SECRET=whsec_<b64> node server/index.js`, then post a
  payload signed the same way. `RESEND_API_KEY=re_invalid…` proves the send path
  without delivering mail (Resend answers "API key is invalid" → 502).

Verification note: the preview harness restores a signed-out session on every
fresh page load, so pages behind `ProtectedRoute` can only be checked by signing
in inside the preview pane (or by driving the login form in the same script that
asserts the signed-in screen).

## AI coach

`src/pages/SpazaCoach.jsx` calls `api.integrations.Core.InvokeLLM`, which posts to
the Supabase Edge Function `coach`. No such function ships in this repository;
until one is deployed with a model provider key the page shows its "try again
later" message. Business context in the prompt comes from Supabase tables.
