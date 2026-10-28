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
`https://8000-$BASE44_PUBLIC_HOST_SUFFIX/api/...`. A real deployment must serve
those two paths from `server/index.js` behind `https://myspaza-app.co.za/api/...`.

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

  Every table has RLS enabled with an `authenticated` policy, matching the
  app's single-shop sharing model.
- **Storage** — product photos go to the public `inventory-media` bucket; the
  write policy lives in `supabase/migrations/`.
- **AI coach** — `Spaza Coach` calls a Supabase Edge Function named `coach`
  (`POST /functions/v1/coach` with `{ prompt }`, returns `{ text }`). Deploy
  that function with your own model provider key to enable live answers; without
  it the page shows a friendly "try again later" message.

## Project layout

```
src/api/supabase.js     Supabase browser client
src/api/client.js       Entity + auth + storage API used by the screens
src/lib/AuthContext.jsx Session state for the whole app
src/lib/offline*        Offline cache and write queue over the entity layer
supabase/migrations/    SQL policies applied to the Supabase project
server/                 Resend email service (auth emails + delivery webhook)
```
