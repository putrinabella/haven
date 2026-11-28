# Haven

Next.js (App Router) + Neon Postgres (Drizzle) + Neon Auth + TanStack Query + Tailwind 4 / DaisyUI.

## Setup

```bash
bun install
cp .env.example .env.local      # fill in real values (see below)
bun run db:migrate              # apply migrations to your Neon database
bun run dev
```

Package manager: **bun** (`bun.lock` is the lockfile). Tests use Node's built-in runner, so Node >= 22.18 is also required.

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
| `bun run dev` / `build` / `start` | Next.js lifecycle |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint (next core-web-vitals + typescript) |
| `bun run test` | Node's built-in test runner on `src/**/*.test.ts` |
| `bun run check` | typecheck + lint + test |
| `bun run db:generate` / `db:migrate` / `db:studio` | Drizzle Kit |

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

## Security & rollout
See [docs/security.md](docs/security.md): credential rotation checklist, CSP design/rollout, rate-limiting details.

Server Actions must be exported via `defineAction({ name, input, rateLimit? }, handler)` (auth -> rate limit ->
validation). Rate limiting needs migration `0001_rate_limits` applied (`bun run db:migrate`).

After the first `bun install`, run `bun run db:generate`: it must report no schema changes. If it generates anything,
delete `src/db/migrations/0001_*` and `meta/0001_snapshot.json`, remove the 0001 entry from `meta/_journal.json`,
and re-run it so drizzle-kit produces the canonical files.

## List pages: filters that survive navigation
Filters live in the URL, not component state, so opening a detail page and coming back keeps them.
- `useDataFilters(initial, { searchKey })` (`src/shared/hooks/use-data-filters.ts`): search (debounced), page and custom
  string filters. Defaults are dropped from the URL; Back leaves the list rather than undoing filters.
- List page: `const toDetail = useReturnToHref();` then `<Link href={toDetail(`/items/${id}`)}>`.
- Detail page: `const back = useBackToList("/items");` for the "Back to list" button (`returnTo` is validated as a
  same-origin relative path, so it cannot be used as an open redirect). The browser Back button needs no helper.
- Components that read search params must sit inside a `<Suspense>` boundary (required by `cacheComponents`).
- Include the filter values in the TanStack Query `queryKey`, or the cache can return data for a different filter.

## Auth routes
Custom `/login` and `/register` (Neon `authClient`) are the single auth UI. `/auth/*` redirects to them.
Not built yet: forgot/reset password and email verification screens.

## Known gaps (intentional, tracked)
- `script-src` CSP is Report-Only until verified in a browser.
- `DockNavbar` links to /food, /finance, /beauty modules that do not exist yet.
- Optional hardening: `proxy.ts` with `auth.middleware({ loginUrl: "/login", publicRoutes: ["/login", "/register"] })`
  for early redirects (documented API; not added because it could not be run here). The layout guard stays the source of truth.
