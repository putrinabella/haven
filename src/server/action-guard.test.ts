import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Returns the exports of a "use server" module that do NOT go through defineAction.
 * Anything exported from such a module is a public POST endpoint, so it must be wrapped
 * (auth + rate limit + validation) or it can be invoked directly without those checks.
 */
export function findUnguardedExports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/^\s*["']use server["']/.test(code)) return [];
  const offenders: string[] = [];
  for (const m of code.matchAll(/^export\s+(?!type\b|interface\b)(.*)$/gm)) {
    if (!/^const\s+\w+\s*=\s*define(?:Household)?Action\s*\(/.test(m[1])) offenders.push(m[0].trim());
  }
  return offenders;
}

test("detector flags unwrapped exports and accepts defineAction ones", () => {
  const ok = `"use server";\nexport const a = defineAction({ name: "a", input: s }, async () => 1);\nexport type T = 1;`;
  assert.deepEqual(findUnguardedExports(ok), []);
  assert.deepEqual(findUnguardedExports(`"use server";\nexport const h = defineHouseholdAction({ name: "h", input: s }, async () => 1);`), []);
  assert.equal(findUnguardedExports(`"use server";\nexport async function bad() {}`).length, 1);
  assert.equal(findUnguardedExports(`"use server";\nexport const b = async () => 1;`).length, 1);
  assert.equal(findUnguardedExports(`"use server";\nexport default async function () {}`).length, 1);
  assert.deepEqual(findUnguardedExports(`export async function fine() {}`), []); // not a "use server" file
});

test('every "use server" module in src/ exports only defineAction-wrapped actions', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) {
        for (const o of findUnguardedExports(readFileSync(p, "utf8"))) offenders.push(`${p}: ${o}`);
      }
    }
  };
  walk("src");
  assert.deepEqual(offenders, []);
});
