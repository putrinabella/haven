import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: { "no-console": ["warn", { allow: ["error", "warn"] }] },
  },
  // Import boundaries: dependencies point one way (app/features -> shared -> lib).
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@/features", "@/features/*"], message: "shared/ must stay feature-agnostic: pass behavior in via props." },
            { group: ["@/db", "@/db/*", "@/server", "@/server/*"], message: "shared/ is client-safe: no direct DB or server-only imports." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/shared", "@/shared/*", "@/features", "@/features/*"], message: "lib/ is infrastructure: it must not depend on UI or features." }] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
