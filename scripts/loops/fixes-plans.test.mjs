// The five fix-topic plans and their shared rules exist, and each plan's Status table parses.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plans = new URL("../../plans/", import.meta.url).pathname;
const CATEGORIES = ["ui", "tooling", "perf", "bug", "nit"];

describe("fix topics", () => {
  it("has a rules file naming the category rule and its tie-break", () => {
    const rules = readFileSync(`${plans}fixes-rules.md`, "utf8");
    expect(rules).toContain("bug`, `perf`, `ui`, `tooling`, `nit`");
    expect(rules).toContain("one slice and one backlog item per fix");
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
});
