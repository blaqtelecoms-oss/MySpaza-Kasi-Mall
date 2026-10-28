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
