import { describe, expect, test } from "vitest";
import { medicationOriginFromState, medicationPageState } from "./medicationOrigin";

const G = "g1";
const HOME = `/app/groups/${G}`;
const LIST = { url: `${HOME}/medications/list`, label: "Medications" };
const from = (url: string) => medicationOriginFromState(G, medicationPageState(url));

describe("medicationOriginFromState", () => {
  test("names the screen a link came from, with its search", () => {
    expect(from(`${HOME}/medications/schedule`)).toEqual({
      url: `${HOME}/medications/schedule`,
      label: "Schedule",
    });
    expect(from(`${HOME}/medications/list?q=met&status=current`)).toEqual({
      url: `${HOME}/medications/list?q=met&status=current`,
      label: "Medications",
    });
    expect(from(`${HOME}/medications/passes`).label).toBe("Passes");
    expect(from(`${HOME}/timeline?kinds=dose`)).toEqual({
      url: `${HOME}/timeline?kinds=dose`,
      label: "Timeline",
    });
    expect(from(`${HOME}/search?q=lisinopril`)).toEqual({
      url: `${HOME}/search?q=lisinopril`,
      label: "Search",
    });
    expect(from(`${HOME}/planner/past`).label).toBe("Planner");
    expect(from(`${HOME}/providers/p1`).label).toBe("Provider");
    expect(from(`${HOME}/todos/t1`).label).toBe("Todo");
    expect(from(`${HOME}/profile/conditions/c1`).label).toBe("Condition");
  });

  test("no state, or anything else, is the Medications list", () => {
    expect(medicationOriginFromState(G, null)).toEqual(LIST);
    expect(medicationOriginFromState(G, undefined)).toEqual(LIST);
    expect(medicationOriginFromState(G, { medicationSheet: true })).toEqual(LIST);
    expect(medicationOriginFromState(G, { medicationFrom: 3 })).toEqual(LIST);
    // Another site, another group, or a screen that opens no medication.
    expect(from("//evil.example/app")).toEqual(LIST);
    expect(from("https://evil.example/app/groups/g1/timeline")).toEqual(LIST);
    expect(from("/app/groups/g2/timeline")).toEqual(LIST);
    expect(from(`${HOME}/medications/m1`)).toEqual(LIST);
    expect(from(`${HOME}/providers/new`)).toEqual(LIST);
    expect(from(`${HOME}/todos/new`)).toEqual(LIST);
    expect(from(`${HOME}/profile/conditions/new`)).toEqual(LIST);
    expect(from(`${HOME}/settings`)).toEqual(LIST);
  });

  test("drops a hash", () => {
    expect(from(`${HOME}/timeline#x`).url).toBe(`${HOME}/timeline`);
  });
});
