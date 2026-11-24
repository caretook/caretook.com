// Type-aware ESLint outgrows Node's default heap (about 4 GB): `pnpm lint` ran
// out of memory (exit 134) until it got the same limit as the check and CI.
// Every place that runs ESLint over the repo gives it one heap size.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const heaps = (text) => [...text.matchAll(/--max-old-space-size=(\d+)/g)].map((m) => Number(m[1]));

describe("the ESLint heap", () => {
  const { scripts } = JSON.parse(read("package.json"));
  const check = heaps(read("scripts/loops/check-body.sh"));
  const ci = heaps(read(".github/workflows/ci.yml"));

  it("is set by the check and by CI", () => {
    expect(check).toHaveLength(1);
    expect(ci).toHaveLength(1);
    expect(check[0]).toBeGreaterThan(4096);
  });

  it.each(["lint", "lint:fix"])("is the same in the %s script, keeping NODE_OPTIONS", (name) => {
    expect(heaps(scripts[name])).toEqual(check);
    expect(scripts[name]).toContain("${NODE_OPTIONS:+$NODE_OPTIONS }");
    expect(scripts[name]).toMatch(/NODE_OPTIONS="[^"]*" eslint \./);
  });

  it("matches between the check and CI", () => {
    expect(ci).toEqual(check);
  });
});
