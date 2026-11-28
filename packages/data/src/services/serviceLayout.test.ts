import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A PowerSync PUT goes through `createIfAbsent` (upserted.ts). Only that file
// builds an upsert's result by hand with `asCreated` or `unchanged`; a service
// importing them has written its own create-if-absent. The exceptions below
// keep theirs for the reason given, and the list only shrinks: an exception
// that no longer imports them fails until it is taken off.

const HELPERS = ["asCreated", "unchanged"] as const;

const EXCEPTIONS: Record<string, string> = {
  "todoService.ts": "another topic (data-rights) has this file hot",
  "timelineEntryService.ts":
    "after the identity check a dose records its upload, may restore a deleted dose as created, and checks the future and the medication",
};

const servicesDir = dirname(fileURLToPath(import.meta.url));

/** The upsert helpers a module imports from `./upserted`, by name. */
const upsertHelpersImported = (source: string): string[] => {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']\.\/upserted["']/g)) {
    for (const spec of (match[1] ?? "").split(",")) {
      const name = spec
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0];
      if (name && (HELPERS as readonly string[]).includes(name)) names.push(name);
    }
  }
  return names;
};

/** What breaks the layout: a service importing the helpers unlisted, or a listed one that no longer does. */
const layoutFailures = (files: Record<string, string>, exceptions: Record<string, string>): string[] => {
  const failures: string[] = [];
  for (const [file, source] of Object.entries(files)) {
    if (file === "upserted.ts") continue;
    const imported = upsertHelpersImported(source);
    if (imported.length > 0 && !(file in exceptions))
      failures.push(`${file} imports ${imported.join(", ")}: use createIfAbsent`);
  }
  for (const file of Object.keys(exceptions)) {
    const source = files[file];
    if (source === undefined || upsertHelpersImported(source).length === 0)
      failures.push(`${file} no longer imports the upsert helpers: take it off the exceptions`);
  }
  return failures;
};

const serviceFiles = (): Record<string, string> =>
  Object.fromEntries(
    readdirSync(servicesDir)
      .filter((f) => f.endsWith(".ts") && !/\.test\.tsx?$/.test(f))
      .map((f) => [f, readFileSync(join(servicesDir, f), "utf8")]),
  );

describe("the services' upsert layout", () => {
  it("has no service but upserted.ts and the listed exceptions importing asCreated or unchanged", () => {
    expect(layoutFailures(serviceFiles(), EXCEPTIONS)).toEqual([]);
  });

  it("fails on a service importing asCreated, naming the file", () => {
    const files = {
      "upserted.ts": "export const asCreated = () => {};",
      "fixtureService.ts": 'import { asCreated } from "./upserted";',
    };
    expect(layoutFailures(files, {})).toEqual(["fixtureService.ts imports asCreated: use createIfAbsent"]);
  });

  it("finds the helpers in a multi-line import, renamed or beside others", () => {
    const source = 'import {\n  createIfAbsent,\n  unchanged as same,\n  asCreated,\n} from "./upserted";';
    expect(upsertHelpersImported(source)).toEqual(["unchanged", "asCreated"]);
    expect(upsertHelpersImported('import { createIfAbsent } from "./upserted";')).toEqual([]);
    expect(upsertHelpersImported('import { unchanged } from "./elsewhere";')).toEqual([]);
  });

  it("fails on an exception that no longer imports them, and on one that is gone", () => {
    const files = { "fixtureService.ts": 'import { createIfAbsent } from "./upserted";' };
    expect(layoutFailures(files, { "fixtureService.ts": "why", "goneService.ts": "why" })).toEqual([
      "fixtureService.ts no longer imports the upsert helpers: take it off the exceptions",
      "goneService.ts no longer imports the upsert helpers: take it off the exceptions",
    ]);
  });
});
