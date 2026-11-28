import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Soft deletes live in one place: a model with a `deletedAt` column spreads
// `softDeleteFunctions` (`base/softDeleteModel.ts`), which owns the `live`
// filter and the `remove` that sets `deletedAt`. A model outside `base/` that
// writes its own fails here. Clearing `deletedAt` (a restore) isn't a delete
// and passes.

const here = path.dirname(fileURLToPath(import.meta.url));

const modules = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "base" && dir === here ? [] : modules(full);
    const isModule = entry.name.endsWith(".ts") && !/\.test\.tsx?$/.test(entry.name);
    return isModule ? [path.relative(here, full)] : [];
  });

/** What a model's source hand-writes that the soft-delete factory owns, or null. */
const handWrittenSoftDelete = (source: string) => {
  if (/\bdeletedAt\s*:\s*(sql\s*`\s*(now\(\)|current_timestamp)|new Date\b)/i.test(source))
    return "sets deletedAt to the current time";
  if (/\bdeleted_at\s*=\s*(now\(\)|current_timestamp)/i.test(source))
    return "sets deleted_at to the current time";
  if (/\bdeletedAt\s*:\s*\{\s*type\s*:\s*["']isNull["']/.test(source)) return "defines its own live filter";
  if (/\b(const|let|function)\s+live\b/.test(source)) return "defines its own live filter";
  return null;
};

describe("the models folder's soft deletes", () => {
  const files = modules(here);

  it("finds the models", () => {
    expect(files.length).toBeGreaterThan(30);
    expect(files).toContain(path.join("todo", "todoModel.ts"));
  });

  it.each(files)("%s leaves soft deletes to the factory", (file) => {
    expect(handWrittenSoftDelete(readFileSync(path.join(here, file), "utf8"))).toBeNull();
  });

  it("refuses a hand-written soft delete and its live filter", () => {
    const remove = `
      txOrDb(args.tx)
        .update(t)
        .set({ deletedAt: sql\`now()\`, updatedBy: args.authUser?.id ?? SYSTEM_USER.id })
        .where(where)`;
    const live = `const live = (filter, opts = {}) =>
      opts.includeDeleted ? filter : { ...filter, deletedAt: { type: "isNull" } };`;

    expect(handWrittenSoftDelete(remove)).toBe("sets deletedAt to the current time");
    expect(handWrittenSoftDelete(".set({ deletedAt: new Date() })")).toBe(
      "sets deletedAt to the current time",
    );
    expect(handWrittenSoftDelete("sql`UPDATE todo SET deleted_at = now()`")).toBe(
      "sets deleted_at to the current time",
    );
    expect(handWrittenSoftDelete(live)).toBe("defines its own live filter");
  });

  it("lets a restore clear deletedAt", () => {
    const restore = `.set({ ...data, deletedAt: null, createdAt: sql\`now()\`, updatedBy: SYSTEM_USER.id })
      .where(and(eq(t.id, id), isNotNull(t.deletedAt)))`;
    expect(handWrittenSoftDelete(restore)).toBeNull();
  });
});
