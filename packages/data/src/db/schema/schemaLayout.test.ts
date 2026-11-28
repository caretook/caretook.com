import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// What the schema folder holds: every module defines a table, relation, row
// type or Zod schema, or builds columns (the column helpers). Pure logic lives
// in `@caretook/data/domain`. The few pure modules that stay are listed here,
// each with its reason; a module on the list that no longer fits it fails.
const STAYS = {
  // The domain may import only types from the schema, so these stay while they need its values.
  "needs a schema value": [
    "appointments/seriesEdit.ts",
    "assistant/quickEntry.ts",
    "assistant/quickEntryNewItem.ts",
    "assistant/quickEntryPreview.ts",
    "medications/doseSchedule.ts",
    "medications/dueDoses.ts",
    "medications/duePasses.ts",
    "medications/medicationDisplay.ts",
    "medications/scheduleHistory.ts",
    "search/searchDocument.ts",
  ],
  "read by path from scripts/": ["connectors/connectorRules.ts", "timeline/symptomCatalog.ts"],
  "the @caretook/data/series entry (rrule, off the schema index)": ["appointments/series.ts"],
} as const;

const here = path.dirname(fileURLToPath(import.meta.url));

const modules = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return modules(full);
    const isModule =
      entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") && entry.name !== "index.ts";
    return isModule ? [path.relative(here, full)] : [];
  });

/** What a module's source defines that belongs in the schema folder, or null when it's pure. */
const definesSchema = (source: string) => {
  if (/\b(pgTable|pgEnum)\s*\(/.test(source)) return "a table";
  if (/\brelations\s*\(/.test(source)) return "a relation";
  if (/\$infer(Select|Insert)\b|\bInfer(Select|Insert)Model\b/.test(source)) return "a row type";
  if (/\bz\s*\.\s*\w+\s*\(|\bcreate(Select|Insert|Update)Schema\s*\(/.test(source)) return "a Zod schema";
  if (/^import\s+\{[^}]*\}\s+from\s+"drizzle-orm\/pg-core"/m.test(source)) return "column helpers";
  return null;
};

/** Whether a module imports a value (not only types) from another module in the schema folder. */
const importsSchemaValue = (file: string, source: string) =>
  [...source.matchAll(/^import\s+(?!type\s)[^;]*?\s+from\s+"(\.[^"]+)"/gm)].some(([, spec]) => {
    const target = path.resolve(here, path.dirname(file), spec!);
    return target.startsWith(here + path.sep);
  });

const stays = new Map<string, string>(
  Object.entries(STAYS).flatMap(([reason, files]) => files.map((file) => [file, reason] as const)),
);

describe("the schema folder's layout", () => {
  const all = modules(here);

  it("holds only tables, relations, row types, Zod schemas and column helpers, or a listed module", () => {
    const pure = all.filter(
      (file) => !stays.has(file) && !definesSchema(readFileSync(path.join(here, file), "utf8")),
    );
    expect(pure).toEqual([]);
  });

  it("lists only modules that are there and still fit their reason", () => {
    const stale = [...stays].flatMap(([file, reason]) => {
      if (!all.includes(file)) return [`${file}: not in the schema folder`];
      const source = readFileSync(path.join(here, file), "utf8");
      const defines = definesSchema(source);
      if (defines) return [`${file}: defines ${defines}, so needs no listing`];
      if (reason === "needs a schema value" && !importsSchemaValue(file, source))
        return [`${file}: needs no schema value now (move it to the domain)`];
      return [];
    });
    expect(stale).toEqual([]);
  });

  it("tells a schema module from a pure one", () => {
    expect(definesSchema(`export const todoSchema = pgTable("todo", {});`)).toBe("a table");
    expect(definesSchema(`export const todoRelations = relations(todoSchema, () => ({}));`)).toBe(
      "a relation",
    );
    expect(definesSchema(`export type Todo = typeof todoSchema.$inferSelect;`)).toBe("a row type");
    expect(definesSchema(`export const reasonZSchema = z\n  .string()\n  .max(5);`)).toBe("a Zod schema");
    expect(definesSchema(`import { timestamp, uuid } from "drizzle-orm/pg-core";`)).toBe("column helpers");
    expect(definesSchema(`import type { AnyPgColumn } from "drizzle-orm/pg-core";`)).toBeNull();
    expect(definesSchema(`export const dayLabel = (day: string) => day.slice(5);`)).toBeNull();
    expect(
      importsSchemaValue("medications/dueDoses.ts", `import { DOSE_STATUSES } from "./medication";`),
    ).toBe(true);
    expect(
      importsSchemaValue("medications/dueDoses.ts", `import type { Medication } from "./medication";`),
    ).toBe(false);
    expect(
      importsSchemaValue(
        "medications/dueDoses.ts",
        `import { addDays } from "../../../domain/core/entryTiming";`,
      ),
    ).toBe(false);
  });
});
