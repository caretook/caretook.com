// The five fix-topic plans and their shared rules exist, and each plan's Status table parses
// (all rows, or what `risa status-trim` left; the moved rows' tables in its history parse too).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextSlice } from "../project/status-trim.mjs";

const plans = new URL("../../plans/", import.meta.url).pathname;
const CATEGORIES = ["ui", "tooling", "perf", "bug", "nit"];

/** Each table's rows (cells) in the text, one array per table. */
const tables = (text) => {
  const out = [];
  let cur = null;
  for (const l of text.split("\n")) {
    if (!l.startsWith("|")) {
      cur = null;
      continue;
    }
    if (!cur) out.push((cur = []));
    cur.push(
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
  }
  return out;
};
const HEADER = ["Slice", "Item", "State", "Merge"];

describe("fix topics", () => {
  it("has a rules file naming the category rule and its tie-break", () => {
    const rules = readFileSync(`${plans}fixes-rules.md`, "utf8");
    expect(rules).toContain("bug`, `perf`, `ui`, `tooling`, `nit`");
    expect(rules).toContain("One slice and one backlog item per fix.");
  });

  it.each(CATEGORIES)("fixes-%s has a plan with a parsing Status table", (cat) => {
    const text = readFileSync(`${plans}fixes-${cat}-plan.md`, "utf8");
    expect(text).toContain("[`plans/fixes-rules.md`](fixes-rules.md)");
    expect(text).toContain(`Topic \`fixes-${cat}\``);
    const status = text.split(/^## Status$/m)[1];
    expect(status).toBeDefined();
    const rows = status
      .split("\n")
      .filter((l) => l.startsWith("|"))
      .map((l) =>
        l
          .split("|")
          .slice(1, -1)
          .map((c) => c.trim()),
      );
    expect(rows[0]).toEqual(["Slice", "Item", "State", "Merge"]);
    expect(rows[1].every((c) => /^-+$/.test(c))).toBe(true);
    expect(rows[1]).toHaveLength(4);
  });

  it.each(CATEGORIES)("fixes-%s's history, if any, holds only slice tables of the same columns", (cat) => {
    const file = `${plans}fixes-${cat}-history.md`;
    if (!existsSync(file)) return;
    const found = tables(readFileSync(file, "utf8"));
    expect(found.length).toBeGreaterThan(0);
    for (const rows of found) {
      expect(rows[0]).toEqual(HEADER);
      expect(rows[1].every((c) => /^-+$/.test(c))).toBe(true);
      for (const row of rows.slice(2)) expect(row[0]).toMatch(/^\d+$/);
    }
  });

  it.each(CATEGORIES)(
    "fixes-%s's next slice number is past every slice in the plan and its history",
    (cat) => {
      const text = readFileSync(`${plans}fixes-${cat}-plan.md`, "utf8");
      const file = `${plans}fixes-${cat}-history.md`;
      const history = existsSync(file) ? readFileSync(file, "utf8") : "";
      const next = nextSlice(text, history);
      const seen = [...`${text}\n${history}`.matchAll(/^(?:#{2,4} Slice (\d+)\b|\| (\d+) +\|)/gm)].map((m) =>
        Number(m[1] ?? m[2]),
      );
      expect(seen.every((n) => n < next)).toBe(true);
    },
  );
});
