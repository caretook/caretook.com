import { describe, expect, it } from "vitest";
import { todoFilterMenu } from "./TodoFilters";

const URGENT = { id: "6f1c1d1e-0000-4000-8000-000000000001", name: "Urgent" };

describe("the Todos tab's Filter menu", () => {
  it("has only Assigned to when the group has no tags", () => {
    const menu = todoFilterMenu("?who=mine", "mine", []);
    expect(menu.sections.map((s) => s.id)).toEqual(["who"]);
    expect(menu.clear).toBe("");
  });

  it("adds a Tag section with a tag, and Clear filters drops both", () => {
    const search = `?who=mine&tag=${URGENT.id}`;
    const menu = todoFilterMenu(search, "mine", [URGENT]);
    expect(menu.sections.map((s) => [s.id, s.current])).toEqual([
      ["who", "mine"],
      ["tag", URGENT.id],
    ]);
    expect(menu.sections[1]!.options.map((o) => [o.label, o.search])).toEqual([
      ["Any", "?who=mine"],
      ["Urgent", search],
    ]);
    // Everyone keeps the tag.
    expect(menu.sections[0]!.options[0]!.search).toBe(`?tag=${URGENT.id}`);
    expect(menu.clear).toBe("");
  });
});
