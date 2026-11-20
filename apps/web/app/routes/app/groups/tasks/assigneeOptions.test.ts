import { describe, expect, it } from "vitest";
import { assigneeOptions, canAssignName, memberName, UNASSIGNED_OPTION } from "./assigneeOptions";

const ME = "me";
const MEMBERS = [
  { userId: "sam", name: "Sam Okafor" },
  { userId: ME, name: "Alex Moreno" },
  { userId: "zoe", name: "Zoë Brandt" },
];

describe("assigneeOptions", () => {
  it("is Unassigned, then me, then the rest by name", () => {
    expect(assigneeOptions(MEMBERS, "", ME).map((o) => o.id)).toEqual([UNASSIGNED_OPTION, ME, "sam", "zoe"]);
    expect(assigneeOptions(MEMBERS, "", ME)[1]?.label).toBe("Alex Moreno (you)");
  });

  it("filters by the start of any word, accents ignored", () => {
    expect(assigneeOptions(MEMBERS, "oka", ME).map((o) => o.id)).toEqual(["sam"]);
    expect(assigneeOptions(MEMBERS, "zoe", ME).map((o) => o.id)).toEqual(["zoe"]);
    expect(assigneeOptions(MEMBERS, "may", ME)).toEqual([]);
  });

  it("offers a typed name that isn't a member's", () => {
    expect(canAssignName(MEMBERS, "Aunt May")).toBe(true);
    expect(canAssignName(MEMBERS, "sam okafor")).toBe(false);
    expect(canAssignName(MEMBERS, "  ")).toBe(false);
    expect(memberName({ userId: "x", name: null }, ME)).toBe("Member");
  });
});
