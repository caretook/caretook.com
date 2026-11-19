import type { MedicationSchedule } from "./medication";

import { describe, expect, it } from "vitest";
import {
  canAddPass,
  medicationPassContentZSchema,
  medicationsInPass,
  nextSortOrder,
  passMoved,
  passMovedId,
  passNameTaken,
  reorderPasses,
  slotTimes,
  sortPasses,
  withoutPass,
} from "./medicationPass";
import { timelineEntryContentZSchema } from "./timelineEntry";

const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
const NOON = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1003";

const pass = (
  id: string,
  name: string,
  time: string,
  sortOrder: number,
  deletedAt: string | null = null,
) => ({
  id,
  name,
  time,
  sortOrder,
  deletedAt,
});
const morning = pass(MORNING, "Morning", "08:00", 0);
const evening = pass(EVENING, "Evening", "20:00", 1);
const noon = pass(NOON, "Noon", "12:00", 2);

const scheduled = (...slots: object[]) => ({ type: "scheduled", slots }) as MedicationSchedule;

describe("pass content", () => {
  it("needs a name and an HH:MM time", () => {
    expect(medicationPassContentZSchema.parse({ name: " Bedtime ", time: "21:30" })).toEqual({
      name: "Bedtime",
      time: "21:30",
      sortOrder: 0,
    });
    expect(medicationPassContentZSchema.safeParse({ name: " ", time: "21:30" }).success).toBe(false);
    expect(medicationPassContentZSchema.safeParse({ name: "Late", time: "9pm" }).success).toBe(false);
    expect(medicationPassContentZSchema.safeParse({ name: "x".repeat(41), time: "09:00" }).success).toBe(
      false,
    );
  });
});

describe("sortPasses", () => {
  it("orders by sort order, then time, then name", () => {
    const tied = pass(NOON, "Brunch", "08:00", 0);
    expect(sortPasses([evening, noon, tied, morning]).map((p) => p.name)).toEqual([
      "Brunch",
      "Morning",
      "Evening",
      "Noon",
    ]);
    expect(
      sortPasses([pass(NOON, "b", "08:00", 0), pass(EVENING, "A", "08:00", 0)]).map((p) => p.name),
    ).toEqual(["A", "b"]);
  });
});

describe("names and the cap", () => {
  it("takes a live pass's name, whatever its case; a deleted one's is free", () => {
    const passes = [morning, evening, pass(NOON, "Noon", "12:00", 2, "2026-11-01T00:00:00.000Z")];
    expect(passNameTaken(passes, " morning ")).toBe(true);
    expect(passNameTaken(passes, "MORNING", MORNING)).toBe(false);
    expect(passNameTaken(passes, "Noon")).toBe(false);
    expect(passNameTaken(passes, "Bedtime")).toBe(false);
  });

  it("allows at most eight live passes", () => {
    const seven = Array.from({ length: 7 }, (_, i) => pass(`p${i}`, `P${i}`, "08:00", i));
    expect(canAddPass(seven)).toBe(true);
    expect(canAddPass([...seven, pass("p7", "P7", "09:00", 7)])).toBe(false);
    expect(canAddPass([...seven, pass("p7", "P7", "09:00", 7, "2026-11-01T00:00:00.000Z")])).toBe(true);
  });

  it("puts a new pass last", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(nextSortOrder([morning, evening])).toBe(2);
    expect(nextSortOrder([morning, pass(NOON, "Noon", "12:00", 5, "2026-11-01T00:00:00.000Z")])).toBe(1);
  });
});

describe("reorderPasses", () => {
  it("swaps a pass with its neighbour and renumbers what changed", () => {
    expect(reorderPasses([morning, evening, noon], NOON, "up")).toEqual([
      { id: NOON, sortOrder: 1 },
      { id: EVENING, sortOrder: 2 },
    ]);
    expect(reorderPasses([morning, evening, noon], MORNING, "down")).toEqual([
      { id: EVENING, sortOrder: 0 },
      { id: MORNING, sortOrder: 1 },
    ]);
  });

  it("does nothing at either end, or for an unknown or deleted pass", () => {
    expect(reorderPasses([morning, evening], MORNING, "up")).toEqual([]);
    expect(reorderPasses([morning, evening], EVENING, "down")).toEqual([]);
    expect(reorderPasses([morning, evening], "nope", "up")).toEqual([]);
    expect(
      reorderPasses([morning, { ...evening, deletedAt: "2026-11-01T00:00:00.000Z" }], EVENING, "up"),
    ).toEqual([]);
  });

  it("fixes gaps and ties in old sort orders as it goes", () => {
    const loose = [pass(MORNING, "Morning", "08:00", 3), pass(EVENING, "Evening", "20:00", 3)];
    expect(reorderPasses(loose, EVENING, "up")).toEqual([
      { id: EVENING, sortOrder: 0 },
      { id: MORNING, sortOrder: 1 },
    ]);
  });
});

describe("withoutPass", () => {
  it("turns the pass's slot into its time, keeping the amount", () => {
    expect(
      withoutPass(scheduled({ passId: MORNING, amount: "1000 mg" }, { passId: EVENING }), morning),
    ).toEqual({
      type: "scheduled",
      slots: [{ passId: EVENING }, { time: "08:00", amount: "1000 mg" }],
    });
  });

  it("keeps a time of its own already at that time", () => {
    expect(
      withoutPass(scheduled({ passId: MORNING, amount: "2" }, { time: "08:00", amount: "1" }), morning),
    ).toEqual({ type: "scheduled", slots: [{ time: "08:00", amount: "1" }] });
    expect(withoutPass(scheduled({ passId: MORNING, amount: "2" }, { time: "08:00" }), morning)).toEqual({
      type: "scheduled",
      slots: [{ time: "08:00", amount: "2" }],
    });
  });

  it("leaves a schedule without the pass alone", () => {
    const schedule = scheduled({ passId: EVENING });
    expect(withoutPass(schedule, morning)).toBe(schedule);
    const asNeeded: MedicationSchedule = { type: "asNeeded", maxPerDay: 3 };
    expect(withoutPass(asNeeded, morning)).toBe(asNeeded);
  });
});

describe("slotTimes", () => {
  it("gives each slot its time: a pass's, or its own; sorted", () => {
    expect(
      slotTimes(scheduled({ time: "14:00", amount: "5 mg" }, { passId: EVENING }, { passId: MORNING }), [
        morning,
        evening,
      ]),
    ).toEqual([
      { time: "08:00", passId: MORNING, amount: null },
      { time: "14:00", passId: null, amount: "5 mg" },
      { time: "20:00", passId: EVENING, amount: null },
    ]);
  });

  it("follows a retimed pass, keeps a deleted pass's last time, and skips an unknown one", () => {
    const later = { ...morning, time: "08:30" };
    const gone = { ...evening, deletedAt: "2026-11-01T00:00:00.000Z" };
    expect(
      slotTimes(scheduled({ passId: MORNING }, { passId: EVENING }, { passId: NOON }), [later, gone]),
    ).toEqual([
      { time: "08:30", passId: MORNING, amount: null },
      { time: "20:00", passId: EVENING, amount: null },
    ]);
    expect(slotTimes({ type: "asNeeded" }, [morning])).toEqual([]);
  });
});

describe("medicationsInPass", () => {
  it("is the current, live medications with a slot in the pass", () => {
    const meds = [
      { id: "a", status: "current", deletedAt: null, schedule: scheduled({ passId: MORNING }) },
      { id: "b", status: "completed", deletedAt: null, schedule: scheduled({ passId: MORNING }) },
      {
        id: "c",
        status: "current",
        deletedAt: "2026-11-01T00:00:00.000Z",
        schedule: scheduled({ passId: MORNING }),
      },
      { id: "d", status: "current", deletedAt: null, schedule: scheduled({ time: "08:00" }) },
    ];
    expect(medicationsInPass(meds, MORNING).map((m) => m.id)).toEqual(["a"]);
  });
});

describe("passMoved", () => {
  it("is the move's details when the time changed, and nothing for a rename", () => {
    const details = passMoved(morning, { id: MORNING, name: "Morning", time: "08:30" }, ["b", "a"]);
    expect(details).toEqual({
      change: "passMoved",
      passId: MORNING,
      passName: "Morning",
      beforeTime: "08:00",
      afterTime: "08:30",
      medicationIds: ["a", "b"],
    });
    expect(passMoved(morning, { id: MORNING, name: "Breakfast", time: "08:00" }, [])).toBeNull();
  });

  it("is a valid medication change entry", () => {
    const details = passMoved(morning, { id: MORNING, name: "Morning", time: "08:30" }, [
      "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9a1001",
    ]);
    const entry = timelineEntryContentZSchema.safeParse({
      kind: "medicationChange",
      occurredAt: "2026-11-17T10:00:00.000Z",
      timeZone: "America/Los_Angeles",
      details,
    });
    expect(entry.success).toBe(true);
  });

  it("gets the same id from the device's timestamp text and the server's ISO time", () => {
    expect(passMovedId(MORNING, "2026-11-17T21:45:25.229000Z")).toBe(
      passMovedId(MORNING, "2026-11-17T21:45:25.229Z"),
    );
    expect(passMovedId(MORNING, "2026-11-17T21:45:25.229Z")).not.toBe(
      passMovedId(EVENING, "2026-11-17T21:45:25.229Z"),
    );
  });
});
