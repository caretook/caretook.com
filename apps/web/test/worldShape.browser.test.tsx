import type { Fixture } from "./fixtures";

import { describe, expect, test } from "vitest";
import { world as medicationWorld } from "../app/routes/app/groups/medications/medicationWorld";
import { track } from "../app/routes/app/groups/periods/periodWorld";
import { world as plannerWorld } from "../app/routes/app/groups/planner/plannerWorld";
import { world as timelineWorld } from "../app/routes/app/groups/timeline/timelineWorld";
import { FIXTURE_SCHEMAS, fixtureProblems } from "./fixtureShape";

// The shared worlds of the screens a second zone runs (the timeline, doses,
// events, and the care periods they show) pass the server's schemas too, as
// the builders' defaults do (fixtureShape.browser.test.tsx): a world's own
// overrides are rows the server could have sent.

const WORLDS: [string, () => Fixture[]][] = [
  ["timeline", () => timelineWorld()],
  ["medications", medicationWorld],
  ["planner", plannerWorld],
  ["care periods", track],
];

describe("the shared worlds", () => {
  test.each(WORLDS)("the %s world's rows pass the server's schemas", (_name, build) => {
    const rows = build().filter((f) => FIXTURE_SCHEMAS[f.table]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.flatMap((f) => fixtureProblems(f).map((p) => `${f.table}: ${p}`))).toEqual([]);
  });
});
