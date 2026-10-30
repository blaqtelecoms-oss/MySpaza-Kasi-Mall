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
- `netlify.toml`, `public/_redirects`, `netlify/functions/api.mjs`: the public
  deployment at `myspaza-app.co.za` (see below).

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

## Employees (invitations + module permissions)

`supabase/migrations/20261028_shop_employees.sql` adds the team model.

- A **shop is the owner's account**: `shop_member.shop_id` is the owner's auth
  uid, which is also the `created_by_id` on every row. `client.js` stamps
  `created_by_id` with the *shop* the signed-in user works in (`currentShopId`,
  cached per user), so an employee's writes belong to the shop, not to them.
- `shop_member.permissions` maps a module key to `"view"` or `"edit"`; the keys
  live in `src/lib/modules.js` and must match `server/lib/modules.js`. One shop
  per employee (`shop_member.member_id` is unique).
- Enforcement is in Postgres: every app table's policy is now
  `created_by_id = auth.uid() or public.shop_module_level(created_by_id, <modules>)`
  for reads, and `... = 'edit'` for writes. The nav (`Layout.jsx`), the route
  guards (`RequireAccess.jsx`) and the permission editor only mirror that — if a
  screen is gated wrong, the database still refuses the data.
- `Employees` (`/employees`) and `Settings` (`/settings`) are owner-only routes;
  `shop_member` writes are owner-only by policy.
- Invitations: the owner's browser POSTs `/api/invitations` (same origin, proxied
  to the `api` service by `vite.config.js`). `server/lib/shop-invite.js` verifies
  the Supabase access token, takes the shop from **the caller**, stores only a
  SHA-256 token hash in `shop_invite` (7-day expiry, one open invite per email)
  and emails the link with Resend. `APP_URL` sets the link base.
- Employee details: the invitation carries the employee's **name** and
  **monthly salary** (`shop_invite.full_name` / `monthly_salary`), captured in
  the invite dialog and editable on the Employees page. `accept_shop_invite()`
  copies both onto the membership (`shop_member`), so an accepted employee
  keeps them; `api.shop.updateMember` is the only other writer.
- Acceptance: `/invite/<token>` reads `shop_invite_preview()` (safe signed out)
  and calls `accept_shop_invite()`, which requires the signed-in address to match
  the invited one and refuses a second shop. Sign-in/registration honour
  `?next=/invite/<token>` (`src/lib/redirect.js`).
- An employee whose membership disappears has this device's cache wiped
  (`AuthContext.refreshShop` → `clearUserData`), so revoked access does not
  leave the shop's records in an offline cache.
- Verify without a second person: create a throwaway auth user with the service
  role, sign in through `/auth/v1/token?grant_type=password`, then call the RPCs
  and the REST tables with that JWT. `RESEND_API_KEY=re_invalid…` on a second
  server instance proves the invite send path without delivering mail.
- Device caches (`src/lib/userDataReset.js`) are wiped whenever the signed-in
  identity changes, so an offline cache or queued write can never leak between
  accounts on a shared browser.

## Community groups (stokvel, savings groups, bulk buys)

`supabase/migrations/20261031_group_invites_employee_pay.sql` adds the model.
The UI calls the shop's savings account a **stokvel**; the table and entity are
still `stockfell_account` / `StockfellAccount`, so nothing migrates.

- A group is one row the shop owns: the stokvel account (`stockfell_account`),
  a `savings_group` or a `bulk_buy`. Members live in each row's `members` jsonb
  array; `stockfell_account.members` was added for this.
- Invitations mirror employees: the owner's browser POSTs
  `/api/group-invitations` with `{ email, groupKind, groupId, shopId }`.
  `server/lib/group-invite.js` verifies the Supabase session, resolves the shop
  through `server/lib/invite-core.js` (shared with the employee invite), checks
  the group belongs to that shop, stores a SHA-256 token hash in `group_invite`
  and emails the link with Resend. `groupKind` is one of `stokvel`,
  `savings_group`, `bulk_buy`.
- Re-inviting is the **Resend** action: it deletes the open row for that
  address and group (the unique index allows one) and sends a fresh token.
- Acceptance: `/invite/group/<token>` reads `group_invite_preview()` (safe
  signed out) and calls `accept_group_invite()`, which checks the signed-in
  address and appends the member to the group's `members` array without
  duplicating an existing email. `?next=` works the same as employee invites.
- Pending invitations are read from `group_invite` through the entity layer
  (`GroupInvite`), scoped by the owner policy `public.is_shop_owner(shop_id)` so
  branches work too.
- Adding an endpoint means three edits: `server/index.js` routes,
  `netlify/functions/api.mjs` routes (the public site), and the client call.

## Subscriptions (plans + feature gating)

`supabase/migrations/20261029_shop_subscriptions.sql` adds the plan model; the
client matrix is `src/lib/plans.js`.

- **The plan belongs to the shop**, not the user: `public.shop_subscription` is
  keyed by `shop_id` (the owner's auth uid), so employees work under the owner's
  plan. A missing row means Free — that is the default, never write one on load.
- Two copies of the matrix must stay in step: `FEATURES` in `src/lib/plans.js`
  and the arrays inside `public.shop_plan_level()`. Feature keys are module keys
  (`pos`, `inventory`, … `debtors`, `accounting`, `banking`), which is what lets
  `RequirePlan feature="…"` line up with the route.
- Enforcement is in Postgres: `shop_plan_level(shop, modules)` is checked by
  every app table policy *and* inside `shop_module_level()`, so the plan and the
  employee's module grant both have to allow a row. The menu and paywall only
  mirror it.
- **Never hide navigation for plan reasons.** The sidebar filters on admin,
  owner and employee module grants only; a page above the plan must stay
  clickable and render `<UpgradeRequired>` via `RequirePlan` — that is the
  paywall, and it is why `RequirePlan` sits *inside* `RequireOwner`/`RequireModule`
  in `App.jsx`.
- `set_shop_plan(p_plan)` is the only writer, it refuses employees, and it
  decides the timing itself: an upgrade applies now with a fresh month; a
  downgrade is stored in `pending_plan` and takes over at
  `pending_plan_effective_at`. `shop_effective_plan()` resolves which one is live,
  and the client mirrors that rule in `resolvePlan()` — change both together.
- Checkout (`src/components/billing/CheckoutDialog.jsx`) is simulated on purpose:
  a fixed test card, no charge, no card input. Keep it that way until a real
  payment provider is wired in.
- Verify the matrix without a browser by running the helpers inside a rolled-back
  transaction as an employee: `set_config('request.jwt.claims', '{"sub":"<uuid>"}', true)`
  (the sub must be a real uuid — `auth.uid()` casts it), then call
  `shop_module_level` at each tier.

## Shops and branches

`supabase/migrations/20261030_shop_branches.sql` adds the shop record and the
plan's shop allowance.

- **A shop is a trading location, not the account.** The primary shop keeps the
  historic id — the owner's auth uid — so every existing row (`created_by_id`)
  stays put. A branch is a `public.shop` row with a generated id, and its records
  are simply the rows whose `created_by_id` is that branch id.
- `public.shop_owner_id(shop)` resolves an account: the `shop` row's `owner_id`,
  falling back to the id itself (which is what makes a not-yet-created primary
  shop work). `public.is_shop_owner()` is the predicate every app-table policy now
  uses — the owner sees every branch, an employee still needs
  `shop_module_level`. Never go back to `created_by_id = auth.uid()`, or branches
  become invisible.
- Because RLS now hands the owner *all* their branches, the client must scope
  reads itself: `SHOP_SCOPED` in `src/api/client.js` adds
  `created_by_id = <active shop>` to list/filter/get/update/delete/updateMany/
  deleteMany. Add a new shop table there or its branches will blend together.
- Shop allowance: Free 1, Premium 2, Ultra unlimited. Both copies must move
  together — `SHOP_LIMITS` in `src/lib/plans.js` (UI) and `public.shop_limit()`
  (enforcement inside `public.create_shop()`). `null` means unlimited, so never
  resolve it with `??` (that turns Ultra into 1).
- Writes go through security-definer RPCs, never direct table writes:
  `ensure_shop()` (creates the primary row, named after the saved business name),
  `create_shop(name, address)` (counts the owner's shops and refuses past the
  limit), `rename_shop(id, name)` (also updates the branch's `shop_settings`
  business name). `my_shops()` and `shop_billing(shop)` are the reads the context
  uses; `shop_billing` resolves the plan through the owner, so a branch runs on
  the owner's subscription.
- Each branch has its own `shop_settings` row; `create_shop()` copies the primary
  shop's business/receipt blob (with the new name) so receipts print immediately.
- The active branch lives in `localStorage` per account
  (`myspaza:active-shop:<user id>`) and in `shopIdCache`; `AuthContext.switchShop`
  clears the React Query cache before reloading the shop context, because cached
  entity queries are keyed per entity, not per shop.
- Employee invitations follow the branch: `api.shop.invite` posts the active
  `shopId` and `server/lib/shop-invite.js` only accepts it when the `shop` row
  names the caller as owner.
- Ads: only Free sees them. `AdBanner` and `AcademyPromoBanner` return `null` when
  `planInfo.ads` is false (`planHasAds()` in `plans.js`).
- Verify with a throwaway auth user (service role), sign in through the login form
  (email + password), then: add branches up to the plan limit and confirm
  `create_shop` refuses one more, switch branches and confirm a product created in
  one branch is absent in the other, and delete the user plus its `shop` /
  `shop_settings` / `shop_subscription` / data rows afterwards.

## Operator tooling (catalogue copy + plan grants)

`supabase/migrations/20261102_admin_product_copy_and_ultra.sql` adds the admin
helpers; the screen is `/admin/product-copy` ("Catalogue Copy" in the sidebar,
`role = 'admin'` only).

- Every function re-checks `public.is_admin()` and is `security definer`, so RLS
  is unchanged and a non-operator caller gets a `42501` refusal. The screen is
  convenience, not the access control.
- `admin_target_shop(email)` resolves an account to the shop its rows belong to:
  the shop an employee works in, otherwise the account id (the primary shop keeps
  that id). It falls back to `auth.users` when the account has never signed in,
  so a brand-new invitee can be prepared before their first login.
- `admin_copy_products(email)` copies **every** product from every other shop,
  with all columns except `id`/`created_date`/`updated_date`/`created_by_id` — so
  `image_url`, prices, cost and stock travel with the row. `product.id` is `text`
  with **no default**, so the copy generates a fresh 24-character hex id per row
  (a straight column copy fails with `null value in column "id"`). It never
  touches the source rows and never copies the account's own catalogue.
- Re-running is safe: `product_copy_log (source_product_id, target_shop)` records
  what landed, so a retry copies nothing. Rows that fail (e.g. a unique
  constraint) are counted and the first five errors returned instead of aborting
  the whole run.
- `admin_grant_ultra(email, max_shops)` upserts `shop_subscription` with
  `plan = 'ultra'`, clears any pending plan and sets `current_period_end = null`
  — Ultra with no expiry. The store cap lives in the new
  `shop_subscription.max_shops` column, which `public.shop_store_limit()` reads
  ahead of the plan's number; `create_shop()` enforces that value, so a capped
  Ultra account really cannot add a fourth store. `shop_billing()` reports
  `max_shops`, and `client.js` prefers it over `SHOP_LIMITS`, so the shop switcher
  and the plan panel show the same number the database enforces.
- Verify the SQL without a browser by replaying the migrations into a scratch
  Postgres with `auth`/`storage`/`extensions` shims (see the sandbox note below).
  Assert: non-admin refusal, copy counts and image/price fidelity, a second run
  copying zero, the 4th `create_shop` raising, and `shop_billing().max_shops`.
- Replay order quirk: `20261028_shop_employees.sql` needs `shop_settings`, which
  `20261028_shop_logo_and_settings.sql` creates, so run the logo migration first
  when applying the set by hand. The imported tables (`product`, `sale`, …) and
  `profiles` are not in any migration — create them before replaying.

## Sandbox runtime (`docker-compose.base44.yml`)

`docker compose -f docker-compose.base44.yml up -d` runs two services.

`app` (host port `3000`):

- Node 22 running `npm install && npm run dev` (Vite) from the bind-mounted
  checkout, so edits hot-reload. Host port `3000` maps to Vite's `:5173`.
- Supabase credentials come from the platform env file `/run/base44/app.env`
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). They are never committed.
- `.env.base44-defaults` is listed **before** `/run/base44/app.env` and holds
  fake, valid-looking Supabase values so a sandbox with no credentials still
  boots and renders the sign-in screen instead of a blank page
  (`src/api/supabase.js` throws without them). They are placeholders only:
  sign-in, data, uploads and email fail until the real project URL and anon key
  are added as secrets. Because `app.env` is listed last, real values win.
- `BASE44_PREVIEW_MODE=1` makes `vite.config.js` bind the dev server to
  `0.0.0.0` and accept the preview host (`.<BASE44_SANDBOX_HOST_DOMAIN>`, e.g.
  `3000-<sandbox id>.e2b.app`) so the preview proxy can reach it. Unset,
  `npm run dev` keeps its default localhost binding and host checks.
- `CHOKIDAR_USEPOLLING=true` (with `CHOKIDAR_INTERVAL=300`): inotify events do
  not reach the bind-mounted checkout, so without polling Vite kept serving the
  first transform of a file and a reload still showed stale code. If an edit
  seems to vanish, confirm the dev server serves it:
  `curl -s localhost:3000/src/App.jsx | grep <new-token>`.
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

## Public deployment (Netlify, https://myspaza-app.co.za)

The public site is a static build of `dist/`, not the dev server, so anything the
preview supplies has to exist there explicitly:

- `public/_redirects` holds the SPA fallback (`/* /index.html 200`) and routes
  `/api/*` to `netlify/functions/api.mjs`. Without the fallback every path but
  `/` is a Netlify 404 — deep links, password-reset links and invitation links
  all break, while the preview keeps working because Vite does this itself.
  It lives in `public/` (not only in `netlify.toml`) so it also travels into a
  drag-and-drop `dist/` deploy.
- `netlify/functions/api.mjs` is a thin adapter over the same handlers the
  sandbox email service runs (`server/lib/*`): it maps the rewritten
  `/.netlify/functions/api/<path>` back to `/api/<path>` and passes the raw body
  and headers through. When adding an endpoint to `server/index.js`, add the
  same path to its `routes` map, or the public site 404s where the preview works.
- The function needs its secrets as Netlify environment variables
  (`RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPABASE_SEND_EMAIL_HOOK_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `APP_URL`). `VITE_*` are also inlined into the browser bundle at build time.

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
- The hook URI points at the **deployed** endpoint
  `https://myspaza-app.co.za/api/hooks/supabase/send-email`, never at a sandbox
  host: the sandbox public host rotates, and a stale URI there makes every
  signup fail with `500 unexpected_failure "Service currently unavailable due to
  hook"` (the account is not created). The project config is readable and
  editable with `SUPABASE_ACCESS_TOKEN` from `/run/base44/app.env`
  (`GET`/`PATCH https://api.supabase.com/v1/projects/<ref>/config/auth`,
  field `hook_send_email_uri`). The deployed route accepts the same
  `SUPABASE_SEND_EMAIL_HOOK_SECRET` the sandbox service uses.
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
