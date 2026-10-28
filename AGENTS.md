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
- Row level security is the access control: every table allows `authenticated`
  users only. Never weaken a policy to make a screen work.
- `public.profiles` mirrors each auth user (`id`, `email`, `full_name`,
  `role`). A missing profile is created on first sign-in.
- Run `npm run lint` and `npm run build` before finishing a change.

## Sandbox runtime (`docker-compose.base44.yml`)

`docker compose -f docker-compose.base44.yml up -d` runs one service:

- Node 22 running `npm install && npm run dev` (Vite) from the bind-mounted
  checkout, so edits hot-reload. Host port `3000` maps to Vite's `:5173`.
- Supabase credentials come from the platform env file `/run/base44/app.env`
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). They are never committed.
- `BASE44_PREVIEW_MODE=1` makes `vite.config.js` bind the dev server to
  `0.0.0.0` so the preview proxy can reach it. Unset, `npm run dev` keeps its
  default localhost binding.
- The app talks to Supabase directly from the browser, so there is no local
  backend service and no `/api` proxy.

Verification note: the preview harness restores a signed-out session on every
fresh page load, so pages behind `ProtectedRoute` can only be checked by signing
in inside the preview pane (or by driving the login form in the same script that
asserts the signed-in screen).

## AI coach

`src/pages/SpazaCoach.jsx` calls `api.integrations.Core.InvokeLLM`, which posts to
the Supabase Edge Function `coach`. No such function ships in this repository;
until one is deployed with a model provider key the page shows its "try again
later" message. Business context in the prompt comes from Supabase tables.
