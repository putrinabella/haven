# Haven architecture

Status: foundation. Everything here was type-checked only partially and unit-tested for the pure `*-core.ts`
modules; run `bun run check` and `bun run build` before relying on it (see "Verification" at the bottom).

## Layers

| Layer | Path | Rule |
| --- | --- | --- |
| Pages / UI | `src/app`, `src/features/*`, `src/shared/*` | May not import `@/db` or `@/server` from `src/shared` (ESLint-enforced). |
| API (REST) | `src/app/api/v1/**/route.ts` | Every handler is wrapped in `defineRoute`. |
| Server actions | `"use server"` files | Every export is `defineAction` / `defineHouseholdAction` (guard test enforces it). |
| Server core | `src/server/*` | auth, tenancy, rate limit, soft delete, purge. `server-only`. |
| Database | `src/db/*`, `src/features/*/schema.ts` | Drizzle schema; migrations in `drizzle/`. |

Pure logic lives in `*-core.ts` files with no framework imports so it can be tested with `node --test`.

## Tenancy: data is shared by household

- `households`, `householdMembers(householdId, userId, role)`; roles `owner > admin > member`.
- Every feature table is built with `householdOwned()` (household FK + createdBy) and `baseColumns()`.
- Every query goes through a `HouseholdContext` ({ userId, householdId, role }); use `forHousehold(table, ctx)`
  from `src/server/soft-delete.ts`, never a bare `where` on a feature table.
- Active household: `x-household-id` header (strict: not a member -> 403) or the HttpOnly `haven_household`
  cookie (lenient: falls back to the oldest membership). Set the cookie with `PUT /api/v1/households/active`.

## IDs and soft delete

- UUID primary keys (`defaultRandom()`).
- `deletedAt` / `deletedBy` on every table. Normal reads use `activeOnly`; "trash" views use `trashOf`.
- Unique constraints must be **partial** (`WHERE deleted_at IS NULL`) so a soft-deleted row never blocks re-creating it.
- Hard delete: `POST /api/v1/households/{id}/purge-deleted` (owner only, irreversible). It deletes soft-deleted rows
  children-before-parents using the registry in `src/server/purge-core.ts`. A row still referenced by a live row
  (FK 23503) is reported as `blocked`, never forced.
- Adding a feature table: add it to the purge registry, otherwise its trash is never purged (a test covers ordering).

## REST API (`/api/v1`)

Envelope (all responses, including errors):

```json
{ "meta": { "success": true, "code": 200, "message": "OK", "requestId": "...", "errorCode": "optional" },
  "data": {}, "errors": { "fieldErrors": { "name": ["Required"] } } }
```

- Lists: `data: { items, meta: { page, size, total, totalPages } }` (`paginated()` helper).
- `defineRoute({ name, body?, query?, params?, rateLimit?, public? }, handler)` runs: authenticate -> CSRF origin
  check (cookie auth, unsafe methods) -> rate limit -> validate -> handler. Always `cache-control: no-store`.
- No CORS headers are sent. Opening the API to third-party front ends later needs (1) a bearer/API-key
  authenticator (extension point in `route.ts`) and (2) an explicit CORS allow-list. Do not add `*`.
- First-party browser code uses `createCrudService` / `apiFetch`; Server Components query the DB directly.

## Theming

DaisyUI `light` and `dark` themes are overridden in `globals.css`. With no `data-theme`, the OS preference decides.
A manual toggle (Phase B) sets `data-theme` on `<html>` and persists it.

## Verification (not done in the authoring sandbox)

- Done: `node --test "src/**/*.test.ts"` (34 passing), filtered `tsc` (only missing-package noise remained).
- Not done: `bun install`, `next build`, ESLint, `bun audit`, DB migrations, real browser checks.
- New tables require `bun run db:generate` then `bun run db:migrate` (review the SQL first).
