# Haven

Next.js (App Router) + Neon Postgres (Drizzle) + Neon Auth + TanStack Query + Tailwind 4 / DaisyUI.

## Setup

```bash
npm install
cp .env.example .env.local      # fill in real values (see below)
npm run db:migrate              # apply migrations to your Neon database
npm run dev
```

Requires Node >= 22.18.

## Environment

Validated at startup by `src/server/env.ts` (fails with a readable list of problems).
Required: `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (>= 32 chars, `openssl rand -base64 32`).
Everything else in `.env.example` is optional until the feature is wired up.

### Secrets
`.env*` is git-ignored except `.env.example`. An `env.txt` containing live credentials was committed in the
initial commit and has been untracked, but **it is still in git history: rotate those credentials** (Neon DB
password, S3 keys, realtime secret) and, if the repo is or becomes public, rewrite history.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js lifecycle |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next core-web-vitals + typescript) |
| `npm test` | Node's built-in test runner on `src/**/*.test.ts` |
| `npm run check` | typecheck + lint + test |
| `npm run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |

## Architecture

```
src/
  app/            Routes only. (auth) = public login/register, (dashboard) = server-guarded.
  db/             Drizzle schema, client (server-only), migrations.
  lib/            Cross-cutting infra: auth client/server, query provider, url-state, validation, error handler.
  server/         Server-only code: env, auth helpers (getUser/requireUser), defineAction (auth + zod + safe errors).
  shared/         UI components, generic hooks (useBase*), service helpers, utils, types. Must stay feature-agnostic.
  features/       (create per feature) components, actions, queries, schema for one domain.
```

Rules of thumb:
- Authorization is enforced on the server: pages via `requirePageUser()` (see `(dashboard)/layout.tsx`),
  mutations via `defineAction` / `requireUser()`. Never trust client checks.
- Layout guards do not re-run on every client-side navigation, so they are a UX gate, not the security boundary.
  Every data read/write must independently verify the user (`requireUser()` / `defineAction`) and scope queries by user id.
- Everything under `src/server` and `src/db/index.ts` imports `server-only`; client code cannot import it.
- `shared/` never imports from `features/`. Features pass behavior in (e.g. `UniversalCalendar`'s `renderItem`).
- Validate every external input with zod; return generic errors to clients and log details server-side.

## Database notes
- The app uses `drizzle-orm/neon-http` (stateless, serverless-friendly). It does not support interactive
  transactions; switch to `neon-serverless` with `DATABASE_URL_POOLED` when you need them.
- `notes` in `src/db/schema.ts` is a scaffold table; replace it with the real domain schema.

## Known gaps (intentional, tracked)
- No rate limiting on app Server Actions yet: it needs a shared store (Upstash/Redis, or a DB table + migration).
- No `script-src` CSP yet (needs nonces); other CSP directives and security headers are set in `next.config.ts`.
- `/auth/[path]` (Neon `AuthView`) coexists with the custom `/login` and `/register`; pick one.
- `DockNavbar` links to /food, /finance, /beauty modules that do not exist yet.
