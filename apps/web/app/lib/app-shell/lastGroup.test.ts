import { describe, expect, it } from "vitest";
import { resolveHomeGroup } from "./lastGroup";

const a = { id: "group-a" };
const b = { id: "group-b" };

describe("resolveHomeGroup", () => {
  it("goes to the remembered group while you're still in it", () => {
    expect(resolveHomeGroup({ groups: [a, b], remembered: "group-b" })).toBe("group-b");
    expect(resolveHomeGroup({ groups: [a], remembered: "group-a" })).toBe("group-a");
  });
  it("ignores a remembered group you're no longer in", () => {
    expect(resolveHomeGroup({ groups: [a, b], remembered: "group-gone" })).toBeNull();
    expect(resolveHomeGroup({ groups: [a], remembered: "group-gone" })).toBe("group-a");
  });
  it("goes to the only group when nothing is remembered", () => {
    expect(resolveHomeGroup({ groups: [a], remembered: null })).toBe("group-a");
  });
  it("shows the list with no groups", () => {
    expect(resolveHomeGroup({ groups: [], remembered: null })).toBeNull();
    expect(resolveHomeGroup({ groups: [], remembered: "group-a" })).toBeNull();
  });
  it("shows the list with several groups and none remembered", () => {
    expect(resolveHomeGroup({ groups: [a, b], remembered: null })).toBeNull();
    expect(resolveHomeGroup({ groups: [a, b], remembered: "" })).toBeNull();
  });
});
