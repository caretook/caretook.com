import type { VitalReading } from "@caretook/data/schema";

import { describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import * as profile from "./route";
import { renderWithDevice } from "../../../../../test/device";
import { fx, hoursAgo, TEST_GROUP } from "../../../../../test/fixtures";

// Recent vital averages on the profile (B-100): the six core types in order,
// each window's average and count from the device's readings (deleted entries
// and old readings left out), "—" for a window without readings, and no
// region at all with nothing in 30 days. The arithmetic is unit-tested in
// `lib/vitalAverages.test.ts`; offline, the units are the defaults (°F, lb).

const URL = `/app/groups/${TEST_GROUP.id}/profile`;
const DAY = 24;

const vital = (hours: number, readings: VitalReading[], deletedAt?: string) =>
  fx.vital({ occurredAt: hoursAgo(hours), readings, ...(deletedAt ? { deletedAt } : {}) });

const open = (fixtures: ReturnType<typeof vital>[]) =>
  renderWithDevice({
    route: { path: "/app/groups/:groupId/profile", module: profile },
    url: URL,
    role: "viewer",
    fixtures,
  });

const region = () => document.querySelector('main [data-section="vital-averages"]');
const cells = (type: string) =>
  [...(region()?.querySelectorAll<HTMLElement>(`tr[data-vital="${type}"] td`) ?? [])].map((td) =>
    td.innerText.replace(/\s+/g, " ").trim(),
  );

describe("recent vital averages", () => {
  test("show the six core types in order, with both windows", async () => {
    await open([
      vital(1, [
        { type: "bloodPressure", systolic: 120, diastolic: 80 },
        { type: "heartRate", value: 72 },
        { type: "temperature", value: 37 },
      ]),
      vital(3, [{ type: "bloodPressure", systolic: 130, diastolic: 84 }]),
      vital(10 * DAY, [
        { type: "bloodPressure", systolic: 140, diastolic: 90 },
        { type: "spo2", value: 95 },
      ]),
      // Too old for either window, deleted, or not a core type: none count.
      vital(40 * DAY, [{ type: "bloodGlucose", value: 300 }]),
      vital(2, [{ type: "heartRate", value: 200 }], hoursAgo(1)),
      vital(1, [{ type: "sleep", value: 7 }]),
    ]);

    await expect.element(page.getByRole("heading", { name: "Recent vital averages" })).toBeVisible();
    const table = page.getByRole("table", { name: /Average readings/ });
    await expect.element(table.getByRole("columnheader", { name: "Last 7 days" })).toBeVisible();
    await expect.element(table.getByRole("columnheader", { name: "Last 30 days" })).toBeVisible();
    expect(
      table
        .getByRole("rowheader")
        .elements()
        .map((el) => el.textContent),
    ).toEqual(["Blood pressure", "Heart rate", "Temperature", "Weight", "Oxygen (SpO₂)", "Blood sugar"]);

    // (120 + 130) / 2, (80 + 84) / 2; then with 140/90: 130, 84.7 → 85.
    expect(cells("bloodPressure")).toEqual(["125/82 mmHg 2 readings", "130/85 mmHg 3 readings"]);
    expect(cells("heartRate")).toEqual(["72 bpm 1 reading", "72 bpm 1 reading"]);
    expect(cells("temperature")).toEqual(["98.6 °F 1 reading", "98.6 °F 1 reading"]);
    expect(cells("weight")).toEqual(["— No readings", "— No readings"]);
    expect(cells("spo2")).toEqual(["— No readings", "95% 1 reading"]);
    expect(cells("bloodGlucose")).toEqual(["— No readings", "— No readings"]);
  });

  test("are hidden with no core readings in 30 days", async () => {
    await open([
      vital(40 * DAY, [{ type: "heartRate", value: 70 }]),
      vital(1, [{ type: "sleep", value: 7 }]),
      vital(2, [{ type: "heartRate", value: 70 }], hoursAgo(1)),
    ]);
    await expect.element(page.getByRole("heading", { name: "Basics" })).toBeVisible();
    expect(region()).toBeNull();
  });
});
