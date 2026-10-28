# AGENTS.md

## Project Context

This is a Base44 app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Base44 References

- CLI overview: https://docs.base44.com/developers/references/cli/get-started/overview.md
- Agent skills: https://docs.base44.com/developers/backend/overview/skills.md

If your agent supports Agent Skills, install or update Base44 skills before Base44-specific work:

```bash
npx skills add base44/skills
```

## Key Files

- `src/`: frontend application source.
- `src/api/base44Client.js`: frontend Base44 SDK client.
- `vite.config.js`: Vite config and Base44 Vite plugin setup.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `base44 dev` as the default local development command when you need the local Base44 backend. It can run the backend and frontend together.
- When docs or code mention the frontend being started automatically, that usually means the Base44 project config includes `site.serveCommand`, for example `"serveCommand": "npm run dev"` in `base44/config.jsonc`.
- Use `npm run dev` only for frontend-only work against the hosted Base44 backend.
- Prefer the existing Base44 CLI workflow over adding new npm scripts for Base44-specific tasks.
- Reuse the existing SDK client and Vite plugin patterns before adding new Base44 integration paths.
- Run the relevant checks from `package.json` before finishing code changes.

## Sandbox runtime (`docker-compose.base44.yml`)

`docker compose -f docker-compose.base44.yml up -d` runs the whole app on this machine with one service:

- `base44 dev -p 4400` starts the Base44 **dev backend** (entities in memory, local email/password auth)
  and, because `base44/config.jsonc` sets `site.serveCommand`, the Vite frontend on `:5173`.
  Host port `3000` maps to that frontend, so `/api` is proxied to the backend by the Base44 Vite plugin —
  single origin, no CORS setup.
- **Login in the sandbox:** the dev backend seeds one user, `dev@spazaflow.local`, and accepts any password.
  Data is in memory only, so it is empty on every container start and is lost when the container is recreated.
- **`docker/base44-cli/auth.json`** is a placeholder CLI session, not a credential: it has no valid signature
  and grants nothing remotely. It only exists because `base44 dev` refuses to start without a CLI session file
  and seeds its local user from it. It is mounted read-only because the CLI deletes the file when a forwarded
  production call returns 401. Replace it with a real `base44 login` session to work against a real account
  (that flow needs a writable `~/.base44/auth` mount instead).
- `base44 dev` only accepts a linked project, and `base44/.app.jsonc` is gitignored, so the compose command
  recreates it from `BASE44_PROJECT_APP_ID` on startup.
- `/api/apps/public/prod/public-settings/...` and OAuth routes are not implemented locally and are forwarded to
  production; the "not supported in local development, passing call to production" warnings in the logs are normal.
- `BASE44_PREVIEW_MODE=1` makes `vite.config.js` bind the dev server to `0.0.0.0` so the preview proxy can reach
  it. Unset, `npm run dev` keeps its default localhost binding.

Verification note: the preview harness restores the signed-out session on every fresh page load, so pages behind
`ProtectedRoute` can only be checked by logging in inside the preview pane by hand.

## Base44 → Supabase migration (`server/`, `/migration`)

The `migration` compose service (`server/index.js`, no npm dependencies) copies this app's Base44 data into the
Supabase project. The admin UI is `/migration` (`src/pages/Migration.jsx`, linked from the sidebar); it calls the
service through the Vite proxy at `/migration-api`, so everything stays on one origin.

- **Phases** (`server/lib/migration.js`): `preflight` (read-only inventory) → `schema` → `users` → `data` →
  `media` → `reconcile`. Every phase is idempotent: tables/columns use `if not exists`, buckets are created only
  when missing, rows are upserted with `resolution=ignore-duplicates` (or `merge-duplicates` when the admin picks
  "overwrite"), and media objects that already have a `media_assets` row are skipped. A retry re-runs from the
  earliest unfinished or problematic phase, so it never duplicates work.
- **Run state** lives on disk in the `migration-runs` volume (`MIGRATION_RUNS_DIR=/data/runs`), which is what makes
  a run resumable after a service restart. No bookkeeping tables are written during a dry run.
- **Schema**: entity tables are generated from `base44/entities/*.jsonc` (snake_case names, e.g. `PurchaseOrder` →
  `purchase_order`); the `User` entity becomes `auth.users` + `public.profiles` (keeping `base44_id`). Every table
  has RLS enabled with an `authenticated` policy matching the app's single-shop sharing model.
- **Supabase APIs**: DDL and RLS policies go through the Management API (`SUPABASE_ACCESS_TOKEN`); rows, storage and
  auth users use the service role key. Base44 password hashes cannot be replayed, so accounts are recreated
  confirmed but password-less — each user must reset their password.
- **Bucket taxonomy** (`server/lib/buckets.js`) follows the app's real media fields: `inventory-media` (public,
  `Product.image_url`), `wholesaler-logos` (public, `Wholesaler.logo_url`), `expense-receipts` (private,
  `Expense.receipt_image`) and `app-uploads` (private fallback for any other media reference).
- **Media detection** covers both Base44 hosts: `base44.app/api/apps/<app>/files/mp/...` and
  `media.base44.com/images/...`.
- **Sandbox auth**: the migration service verifies the caller's Base44 session with
  `GET /api/apps/<app>/entities/User/me` and requires `role: "admin"`. In the sandbox `BASE44_AUTH_API_URL` points
  at `https://3000-${BASE44_PUBLIC_HOST_SUFFIX}` because `base44 dev` binds its API to loopback inside its own
  container; production uses the default `https://base44.app`.

Verifying a migration without the browser:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/apps/<app-id>/auth/login \
  -H 'Content-Type: application/json' -H 'X-App-Id: <app-id>' \
  -d '{"email":"dev@spazaflow.local","password":"x"}' | jq -r .access_token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/migration-api/status
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{}' http://localhost:3000/migration-api/dry-run          # then GET /runs/<id>
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"apply","conflictMode":"skip"}' http://localhost:3000/migration-api/runs
```

`/migration` itself sits behind `ProtectedRoute`, so the preview harness (which always restores a signed-out
session) cannot drive it — sign in in the preview pane and open `/migration` to exercise it by hand.
