import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The light entry stays light: `ui/plain` is for pages that must not load
// React Aria (sign-in, the account forms, the marketing header), so nothing it
// imports, however deep, may import `react-aria*` or `@react-aria/*`.

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "../../..");
const ENTRY = join(here, "index.ts");

const SPECIFIER = /(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|import\s*\(?\s*["']([^"']+)["']/g;

/** A module's import specifiers (static, re-exports, side-effect and dynamic); types only load nothing. */
const specifiers = (source: string) =>
  [...source.matchAll(SPECIFIER)]
    .filter((m) => !/^(import|export) type\s/.test(m[0]))
    .map((m) => m[1] ?? m[2]!);

/** A local specifier's file, or null for a package. */
const resolveLocal = (from: string, spec: string): string | null => {
  const base = spec.startsWith("~/")
    ? join(appDir, spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (!base) return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  const found = candidates.find((c) => existsSync(c) && statSync(c).isFile());
  if (!found) throw new Error(`can't resolve ${spec} from ${relative(appDir, from)}`);
  return found;
};

const isReactAria = (spec: string) => /^(react-aria|@react-aria\/)/.test(spec);

/** Every local module the entry reaches, and the packages each imports. */
const walk = (entry: string) => {
  const seen = new Set<string>();
  const packages: { from: string; spec: string }[] = [];
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      const local = resolveLocal(file, spec);
      if (local) visit(local);
      else packages.push({ from: relative(appDir, file), spec });
    }
  };
  visit(entry);
  return { seen, packages };
};

describe("ui/plain", () => {
  it("imports nothing from React Aria, however deep", () => {
    const { seen, packages } = walk(ENTRY);
    expect(seen.size).toBeGreaterThan(3);
    expect(packages.filter((p) => isReactAria(p.spec))).toEqual([]);
  });

  it("finds React Aria through ui/'s main index (the walk reaches it)", () => {
    const { packages } = walk(join(here, "..", "index.ts"));
    expect(packages.some((p) => isReactAria(p.spec))).toBe(true);
  });

  it("would catch a React Aria import, and skips type-only ones", () => {
    expect(specifiers('import { Button } from "react-aria-components";').filter(isReactAria)).toEqual([
      "react-aria-components",
    ]);
    expect(
      specifiers('export { useFocus } from "@react-aria/interactions";').filter(isReactAria),
    ).toHaveLength(1);
    expect(specifiers('import type { Key } from "react-aria-components";')).toEqual([]);
  });
});
