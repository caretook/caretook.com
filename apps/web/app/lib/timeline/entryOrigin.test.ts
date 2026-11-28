import { describe, expect, it } from "vitest";
import { entryOriginFrom, entryOriginState } from "./entryOrigin";

const G = "g1";
const HOME = `/app/groups/${G}`;
const from = (url: string, idx: number | null = 2) =>
  entryOriginFrom(G, entryOriginState({ from: url, idx }));

describe("entryOriginFrom", () => {
  it("names a provider's page and a todo's, keeping the search and the index", () => {
    expect(from(`${HOME}/providers/p1`)).toEqual({ from: `${HOME}/providers/p1`, idx: 2, label: "Provider" });
    expect(from(`${HOME}/todos/t1?x=1`, null)).toEqual({
      from: `${HOME}/todos/t1?x=1`,
      idx: null,
      label: "Todo",
    });
  });

  it("keeps other state alongside", () => {
    const state = entryOriginState({ from: `${HOME}/todos/t1`, idx: 1 }, { seriesScope: "only" });
    expect(state.seriesScope).toBe("only");
    expect(entryOriginFrom(G, state)?.label).toBe("Todo");
  });

  it("is null for a screen that isn't an opener, another group, or another origin", () => {
    for (const url of [
      `${HOME}/timeline`,
      `${HOME}/providers`,
      `${HOME}/providers/new`,
      `${HOME}/providers/import`,
      `${HOME}/providers/p1/edit`,
      `${HOME}/todos/new`,
      `${HOME}/planner`,
      `/app/groups/g2/providers/p1`,
      "https://example.test/app/groups/g1/providers/p1",
      "//example.test/app/groups/g1/providers/p1",
      "providers/p1",
    ])
      expect(from(url)).toBeNull();
  });

  it("is null for any other state", () => {
    for (const state of [null, undefined, "x", {}, { entryFrom: "x" }, { entryFrom: { from: 3 } }])
      expect(entryOriginFrom(G, state)).toBeNull();
  });

  it("takes a missing index as unknown", () => {
    expect(entryOriginFrom(G, { entryFrom: { from: `${HOME}/providers/p1` } })?.idx).toBeNull();
  });
});
