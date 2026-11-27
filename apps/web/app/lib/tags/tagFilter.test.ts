import { describe, expect, it } from "vitest";
import { ANY_TAG, setTagFilter, tagFilterOf, tagFilterSection } from "./tagFilter";

const URGENT = { id: "6f1c1d1e-0000-4000-8000-000000000001", name: "Urgent" };
const MOVE = { id: "6f1c1d1e-0000-4000-8000-000000000002", name: "Care home move" };
const TAGS = [MOVE, URGENT];

describe("the tag filter", () => {
  it("reads ?tag= only when the group has the tag", () => {
    expect(tagFilterOf(`?tag=${URGENT.id}`, TAGS)).toBe(URGENT);
    expect(tagFilterOf(`?tag=${URGENT.id.toUpperCase()}`, TAGS)).toBe(URGENT);
    // A deleted (unknown) tag, or not an id, is no filter.
    expect(tagFilterOf("?tag=6f1c1d1e-0000-4000-8000-00000000000f", TAGS)).toBeNull();
    expect(tagFilterOf("?tag=urgent", TAGS)).toBeNull();
    expect(tagFilterOf("", TAGS)).toBeNull();
  });

  it("sets and clears ?tag=, keeping the rest", () => {
    expect(setTagFilter("?who=mine", URGENT.id)).toBe(`?who=mine&tag=${URGENT.id}`);
    expect(setTagFilter(`?tag=${URGENT.id}&who=mine`, null)).toBe("?who=mine");
    expect(setTagFilter(`?tag=${URGENT.id}`, null)).toBe("");
  });

  it("has no section when the group has no tags", () => {
    expect(tagFilterSection(`?tag=${URGENT.id}`, [])).toBeNull();
  });

  it("offers Any then each tag, current on the filter's tag", () => {
    const section = tagFilterSection(`?who=mine&tag=${URGENT.id}`, TAGS)!;
    expect(section).toMatchObject({ id: "tag", title: "Tag", current: URGENT.id, defaultId: ANY_TAG });
    expect(section.options).toEqual([
      { id: ANY_TAG, label: "Any", search: "?who=mine" },
      { id: MOVE.id, label: "Care home move", search: `?who=mine&tag=${MOVE.id}` },
      { id: URGENT.id, label: "Urgent", search: `?who=mine&tag=${URGENT.id}` },
    ]);
    // A deleted tag reads as Any.
    expect(tagFilterSection("?tag=6f1c1d1e-0000-4000-8000-00000000000f", TAGS)?.current).toBe(ANY_TAG);
  });
});
