import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ERRORS, ERROR_KEYS } from "./constants";

// The service errors live in one part per area (`<area>.ts`, beside constants.ts).
// ERRORS spreads them, so a code in two parts would silently overwrite itself.
const PARTS = readdirSync(import.meta.dirname).filter(
  (f) =>
    f.endsWith(".ts") && !f.endsWith(".test.ts") && !["constants.ts", "errors.ts", "index.ts"].includes(f),
);

describe("service error parts", () => {
  it("finds the area parts", () => {
    expect(PARTS.length).toBeGreaterThan(5);
  });

  it("defines each error code in exactly one part", async () => {
    const owners = new Map<string, string>();
    const duplicates: string[] = [];
    for (const file of PARTS) {
      const mod = (await import(`./${file.replace(/\.ts$/, "")}.ts`)) as Record<
        string,
        Record<string, unknown>
      >;
      const exports = Object.values(mod);
      expect(exports, `${file} exports one object`).toHaveLength(1);
      for (const code of Object.keys(exports[0] ?? {})) {
        const first = owners.get(code);
        if (first) duplicates.push(`${code} (${first}, ${file})`);
        owners.set(code, file);
      }
    }
    expect(duplicates).toEqual([]);
    for (const code of owners.keys()) expect(ERROR_KEYS).toContain(code);
    expect(ERRORS).toHaveProperty("error");
  });
});
