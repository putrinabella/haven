import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// ENFORCED: directives that cannot break rendering and need no nonces.
const enforcedCsp = ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");

// REPORT-ONLY (rollout stage): the full no-nonce policy from the Next.js CSP guide.
// Nonce-based CSP requires fully dynamic rendering and is documented as incompatible with Partial
// Prerendering, which this app enables (cacheComponents), so 'unsafe-inline' for scripts is the
// documented trade-off. 'unsafe-eval' is dev-only (React debugging) and never sent in production.
// No default-src/connect-src on purpose: the Neon Auth client's network targets are unverified.
// Flip to enforced after a clean pass with no console violations (see docs/security.md).
const reportOnlyCsp = [
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: enforcedCsp },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyCsp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // camera=(self): the barcode scanner needs it. Everything else is off.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // The old Neon AuthView page at /auth/* was removed (deprecated UI package, no provider mounted).
  // Keep any bookmarked or emailed URLs working by sending them to the custom pages.
  async redirects() {
    return [
      { source: "/auth/sign-in", destination: "/login", permanent: false },
      { source: "/auth/sign-up", destination: "/register", permanent: false },
      { source: "/auth/:path*", destination: "/login", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
