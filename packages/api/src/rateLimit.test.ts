import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every per-IP limiter keys through `clientIpKey` (@caretook/auth's host.ts,
// B-337): nothing pools requests without a client IP in one shared bucket.

const root = join(import.meta.dirname, "..", "..");

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });

describe("per-IP limiter keys", () => {
  it("each IP limiter keys through clientIpKey", () => {
    for (const file of [
      "api/src/connectors/http.ts",
      "api/src/calendars/feed.ts",
      "api/src/marketing/publicForms.ts",
      "auth/src/tickets.ts",
      "auth/src/auth.ts",
    ]) {
      expect(readFileSync(join(root, file), "utf8"), file).toMatch(/clientIpKey\(/);
    }
  });

  it("no limiter keys on an 'unknown' fallback", () => {
    const offenders = [join(root, "api", "src"), join(root, "auth", "src")]
      .flatMap(sources)
      .filter((file) => /\|\|\s*["']unknown["']|\?\?\s*["']unknown["']/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
