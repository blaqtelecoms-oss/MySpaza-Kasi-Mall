# My Spaza — Business Manager

Spaza shop management app: POS, inventory, cash-up, banking, expenses,
suppliers, customers, debtors, reports and an AI business coach.

The app is a React + Vite single-page app. All data, media and user accounts
live in **Supabase** (Postgres + Auth + Storage); the browser talks to Supabase
directly with the publishable key, and row level security decides access.

## Prerequisites

- Node.js 20+
- A Supabase project with the app's tables, `profiles` table and storage
  buckets (see [Supabase setup](#supabase-setup))

## Environment variables

Both are read by the browser at build/dev time:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public (anon/publishable) key — safe in the browser because row level security applies |
| `RESEND_API_KEY` | Resend API key used by `server/` to send signup and account emails |
| `RESEND_WEBHOOK_SECRET` | Signing secret of the Resend webhook (`whsec_…`) |
| `SUPABASE_SEND_EMAIL_HOOK_SECRET` | Secret of the Supabase *Send Email* auth hook (`v1,whsec_…`) |
| `APP_URL` | Public base URL used in employee invitation links (e.g. `https://myspaza-app.co.za`) |

The browser only reads the two `VITE_*` values; the Resend and hook secrets are
server-side only and are never bundled into the frontend.

In the Base44 sandbox these arrive from the platform-managed env file
`/run/base44/app.env`. Locally, put them in `.env.local` (never commit secrets).

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (port 5173 by default).

In the sandbox the whole app runs through Docker Compose:

```bash
docker compose -f docker-compose.base44.yml up -d
```

That serves the Vite dev server on host port `3000`, which is what the preview
pane shows, plus the email service on host port `8000`.

## Email (Resend)

Signup verification codes and every other Supabase auth email are delivered
through [Resend](https://resend.com) from `noreply@myspaza-app.co.za`.

`server/` is a small zero-dependency Node service with two signed endpoints:

| Endpoint | Called by | Purpose |
| --- | --- | --- |
| `POST /api/hooks/supabase/send-email` | Supabase Auth *Send Email* hook | Renders the verification-code / reset email and sends it with Resend |
| `POST /api/webhooks/resend` | Resend webhook | Stores every delivery event (`email.sent`, `email.delivered`, `email.bounced`, …) in `public.email_event` |
| `GET /health` | compose healthcheck | Reports whether Resend and the Supabase writer are configured |

Both POST routes verify the Standard Webhooks HMAC signature over the raw body,
reject requests older than five minutes, and never log request bodies because
they carry verification codes. Storage is idempotent on the webhook message id,
so provider retries cannot duplicate history.

### One-time configuration

1. **Resend** — verify the `myspaza-app.co.za` domain, create an API key with
   sending access and store it as `RESEND_API_KEY`.
2. **Supabase Auth hook** — Dashboard → Authentication → Hooks → *Send Email* →
   HTTPS endpoint `https://8000-$BASE44_PUBLIC_HOST_SUFFIX/api/hooks/supabase/send-email`
   (locally: your tunnel or `localhost:8000` equivalent). Supabase displays a
   `v1,whsec_…` secret — store the same value as `SUPABASE_SEND_EMAIL_HOOK_SECRET`.
   Once the hook is enabled Supabase stops sending its own auth emails, so the
   app keeps calling `verifyOtp`/`resend` unchanged; the code just arrives from
   Resend.
3. **Resend webhook** — Resend → Webhooks → endpoint
   `https://8000-$BASE44_PUBLIC_HOST_SUFFIX/api/webhooks/resend`, subscribe to all
   events, and store its signing secret as `RESEND_WEBHOOK_SECRET`.

### Sandbox vs deployed endpoints

The sandbox public host changes whenever the environment is recreated. If
verification emails or delivery events stop arriving, update the Supabase hook
URI and the Resend webhook endpoint to
`https://8000-$BASE44_PUBLIC_HOST_SUFFIX/api/...`.

On the public site the same three paths are served at
`https://myspaza-app.co.za/api/...` by `netlify/functions/api.mjs`, which runs the
handlers from `server/` — see [Deploying](#deploying-to-myspaza-appcoza).

### Email log

`/admin/email-events` ("Email Log" in the sidebar) shows the recorded events to
operators. It reads `public.email_event` through the signed-in user's session,
and the RLS policy allows only a profile with `role = 'admin'`:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

`server/lib/resend.js` exports `sendEmail({ to, subject, html, text })` if another
app notification needs to go out; add a route in `server/index.js` and it reuses
the same sender and secret handling.

## Deploying to myspaza-app.co.za

The public site is a static Netlify deploy: `npm run build` producing `dist/`.
Two things a static host does not get from the Vite dev server are declared in
the repo:

- `public/_redirects` — `/api/*` goes to the `netlify/functions/api.mjs`
  function (invitations, the Supabase Send-Email hook, the Resend webhook);
  every other path serves `index.html` so deep links (`/inventory`),
  password-reset links and invitation links (`/invite/<token>`) load the app
  instead of a Netlify 404.
- `netlify.toml` — build command, publish directory and functions directory.

Set these on the Netlify site (Site configuration → Environment variables);
they are never committed:

| Variable | Used by |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | the browser bundle (inlined at build time, so set them before building) |
| `RESEND_API_KEY` | the function: invitation and auth emails |
| `RESEND_WEBHOOK_SECRET`, `SUPABASE_SEND_EMAIL_HOOK_SECRET` | the function: verifying its two signed callers |
| `SUPABASE_SERVICE_ROLE_KEY` | the function: writing the email log |
| `APP_URL` = `https://myspaza-app.co.za` | invitation links (defaults to the caller's origin) |

The function bundles `server/lib` at deploy time and needs no extra dependency.

## Checks

```bash
npm run lint
npm run build
```

## Supabase setup

- **Auth** — email/password (`signInWithPassword`, `signUp`, recovery links) and
  optional Google OAuth (enable the provider in Supabase → Authentication →
  Providers). Email confirmation is honoured: when it is enabled, sign-up shows
  a code-entry step using the emailed 6-digit token.
- **Profiles** — `public.profiles` mirrors each auth user (`id`, `email`,
  `full_name`, `role`). A row is created automatically on first sign-in when it
  is missing.
- **Data tables** — one table per entity, snake_case name, and the same field
  names the UI uses:

  | Entity | Table |
  | --- | --- |
  | Product | `product` |
  | Sale | `sale` |
  | Customer | `customer` |
  | Supplier | `supplier` |
  | Expense | `expense` |
  | CashUp | `cash_up` |
  | BankAccount | `bank_account` |
  | PurchaseOrder | `purchase_order` |
  | StockAdjustment | `stock_adjustment` |
  | SavingsGroup | `savings_group` |
  | StockfellAccount | `stockfell_account` |
  | Wholesaler | `wholesaler` |
  | WholesalerDiscount | `wholesaler_discount` |
  | BulkBuy | `bulk_buy` |

  Every table has RLS enabled with an owner policy
  (`created_by_id = auth.uid()`), so each account only sees and edits its own
  shop's rows. See [Data ownership](#data-ownership).
- **Storage** — product photos go to the public `inventory-media` bucket and the
  shop logo to the public `shop-logos` bucket; the write policies (scoped to the
  owner's user-id folder) live in `supabase/migrations/`.
- **Shop settings** — `public.shop_settings` holds one row per account (business
  details, receipt options, `logo_url`). The Settings screen saves it and the POS
  receipt prints from it (`src/lib/receipt.js`).
- **AI coach** — `Spaza Coach` calls a Supabase Edge Function named `coach`
  (`POST /functions/v1/coach` with `{ prompt }`, returns `{ text }`). Deploy
  that function with your own model provider key to enable live answers; without
  it the page shows a friendly "try again later" message.

## Employees

Each shop owner can invite employees by email and decide exactly what each one
may see and do (`/employees`, or **Employees** in the sidebar).

1. **Invite** — the owner enters the employee's name, email and monthly salary,
   picks a role and sets each module to *None*, *View* or *Edit*.
   `POST /api/invitations` (served by `server/`)
   verifies the owner's Supabase session, stores the invitation with a hashed
   token and emails the link with Resend. Links expire after 7 days, work once,
   and only for the invited address.
2. **Accept** — `/invite/<token>` shows the shop, role and modules. After signing
   in (or creating an account with the invited address) the employee accepts and
   is attached to that one shop.
3. **Work** — the employee sees the shop name and their role in the app and only
   the modules granted to them. `View` modules are read-only; `Edit` modules can
   create and change records. Employees never see Employees or Settings.
4. **Change access** — the owner edits a role/permission set or removes the
   employee; the change applies to the very next request.

Module permissions are enforced by row level security
(`supabase/migrations/20261028_shop_employees.sql`), not only by the menu, so a
crafted API call cannot reach a module the owner did not grant.

## Community groups (stokvel, savings groups, bulk buys)

On **MySpaza Card** (`/myspaza-card`) the shop's savings account is its
**stokvel**, alongside savings groups and bulk buy orders. Each one can invite
friends by email:

1. **Invite** — on a stokvel, savings group or bulk buy card the owner enters a
   friend's email. `POST /api/group-invitations` verifies the owner's session,
   checks the group belongs to their shop, stores a hashed token and emails the
   link with Resend. Links work once, expire after 7 days and only for the
   invited address.
2. **Resend / cancel** — the pending invitations under each group can be resent
   (a fresh link replaces the old one) or cancelled.
3. **Accept** — `/invite/group/<token>` shows the group, shop and invited
   address. After signing in with that address the friend accepts and is added
   to the group's member list.

The UI calls the account a stokvel; the table stays `stockfell_account` so no
data moves (`supabase/migrations/20261031_group_invites_employee_pay.sql`).

## Subscriptions & plans

Each **shop has one plan**, set by the owner and shared with its employees
(`public.shop_subscription`, migration `20261029_shop_subscriptions.sql`). New
shops start on **Free**.

| Plan | Price | Adds |
| --- | --- | --- |
| Free | R0 | Dashboard, Point of Sale, Inventory, Cash Up, Daily Sales, Expenses, Suppliers, Academy, Calculators, Funding Hub, MySpaza Card, Ads |
| Premium | R199/month | Employees, Reports, Spaza Coach, Customers |
| Ultra | R399/month | Everything, including Debtors Control, Accounting and Banking |

- **Nothing is hidden.** Every page stays in the sidebar on every plan; opening
  one above the shop's plan renders the upgrade overlay in place of the page
  (`RequirePlan` → `UpgradeRequired`), with an **Upgrade Now** button that opens
  the checkout, or **Compare plans** that lands on Settings → Billing.
- **Billing & Subscription** is a tab in Settings (`/settings?tab=billing`):
  the current plan, the three plan cards and a change button on each.
- **Checkout is simulated**: a modal with the plan details, a fixed test card and
  a Pay button. No card details are collected and no charge is made. Upgrading
  applies immediately and shows a success toast.
- **Downgrades are scheduled, not instant**: the current plan stays in force for
  the rest of the paid period (`pending_plan` +
  `pending_plan_effective_at`) and the lower tier takes over at period end.
- The matrix lives in two places that must agree: `src/lib/plans.js` for the
  menu/cards, and `shop_plan_level()` in the migration for Postgres. The
  database is what actually enforces it — every table policy now requires the
  plan to cover the module as well as the employee permission, so a Free shop
  cannot read Ultra data through a crafted API call.

## Data ownership

Each account is isolated at the database level (see
`supabase/migrations/20261028_user_owned_data.sql`):

- Every app table allows `authenticated` access only to rows where
  `created_by_id = auth.uid()`. New rows take their owner from the session,
  and a payload cannot claim another user's id.
- A brand-new account starts with an empty shop: no sample or other-owner rows.
- Rows with no identifiable owner (the imported `service_…` account) stay in the
  database but are invisible to ordinary users.
- `profiles` is per-user readable; `email_event` and `media_assets` are
  operator-only (`role = 'admin'`).
- The device cache (offline reads, queued writes, persisted queries) is cleared
  whenever a different account signs in on the same browser.

## Project layout

```
src/api/supabase.js     Supabase browser client
src/api/client.js       Entity + auth + storage API used by the screens
src/lib/AuthContext.jsx Session state for the whole app
src/lib/offline*        Offline cache and write queue over the entity layer
supabase/migrations/    SQL policies applied to the Supabase project
server/                 Resend email service (auth emails + delivery webhook)
```
