# Security notes

## 1. Credential rotation checklist (exposed via `env.txt`, still in git history)

The initial commit `97e9fd4` contained `env.txt`. **Treat every value in it as compromised.** Names that were
present (values intentionally not repeated here):

| Variable | Why it matters | Action |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_POOLED` | contain the Neon role password | Reset the role password in the Neon Console (Roles), update both URLs. Check Neon's query/connection history for unfamiliar activity. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | object storage access | Create a new key pair at the storage provider, switch the app over, then **delete the old key**. Review access logs. |
| `NEON_REALTIME_SECRET` | realtime signing/auth | Regenerate in the provider console, update `.env.local` and hosting env. |
| `NEON_AUTH_BASE_URL` | endpoint, not a secret | No rotation needed. |
| `NEON_AUTH_COOKIE_SECRET` | was **never** committed | Just generate a fresh one: `openssl rand -base64 32`. |

Order: (1) create new credentials, (2) update `.env.local` + hosting env vars, (3) redeploy and verify,
(4) revoke the old credentials, (5) only then consider history rewrite.

Rotation is mandatory even if you rewrite history: anyone who cloned or forked the repo, and any cache
(GitHub, CI logs, forks), may still hold the old values. If the repo is public or shared, also run
`git filter-repo --path env.txt --invert-paths` (or BFG) and force-push, after rotating.

Never paste secrets into issues, PRs or chats; use hosting-provider env vars. `.env*` is git-ignored except `.env.example`.

## 2. Content Security Policy

- **Enforced now:** `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`.
- **Report-Only (rollout):** full policy in `next.config.ts` (`script-src 'self' 'unsafe-inline'`, no `unsafe-eval` in production).
- **Why not nonces:** Per the Next.js CSP guide, nonces require every page to render dynamically on each request and
  Partial Prerendering is incompatible with nonce-based CSP. This app enables `cacheComponents`, so strict nonces would
  mean giving that up. Option B is the experimental hash-based SRI mode (`experimental.sri`), which keeps static
  rendering but is experimental and was not enabled because it could not be built/tested here.
- **Third-party resources:** none referenced in `src/`; fonts are self-hosted by `next/font`. `connect-src` is left
  unset because the Neon Auth client's network targets were not verified.

Promote to enforced:
1. `bun run build && bun run start`, then exercise login, register, logout, the barcode scanner and every page.
2. Open DevTools console; any "Content-Security-Policy-Report-Only" violation names the blocked source.
3. When clean, rename the header key to `Content-Security-Policy` (replace the enforced one with this stricter set).

## 3. Rate limiting

Server Actions: Postgres-backed fixed window (`src/server/rate-limit.ts`, table `rate_limits`), enforced inside
`defineAction` (default 60 req/min per user per action). `src/server/action-guard.test.ts` fails if any `"use server"`
export bypasses `defineAction`.
Auth endpoints (`/api/auth/*`) are handled by Neon Auth; its rate-limit behavior is **not documented** on the
Next.js reference page, so confirm with Neon (or add an edge/WAF rule) before relying on it.
