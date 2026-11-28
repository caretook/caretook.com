import { describe, expect, it } from "vitest";
import { initialSlots } from "./scheduleSlots";

const MORNING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
const EVENING = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1002";
const NIGHT = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1003";
const ELSEWHERE = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1004";

const passes = [
  { id: MORNING, time: "08:00", deletedAt: null },
  { id: EVENING, time: "20:00", deletedAt: null },
  { id: NIGHT, time: "22:00", deletedAt: "2026-11-18T10:00:00.000Z" },
];

describe("initialSlots", () => {
  it("starts a new medication with nothing ticked, and an 8:00 row only without passes", () => {
    expect(initialSlots(null, passes)).toEqual({ passes: {}, times: [], unknown: [] });
    expect(initialSlots({ type: "asNeeded", maxPerDay: 2 }, passes)).toEqual({
      passes: {},
      times: [],
      unknown: [],
    });
    expect(initialSlots(null, [])).toEqual({
      passes: {},
      times: [{ key: 0, value: "08:00", amount: "" }],
      unknown: [],
    });
  });

  it("ticks the schedule's passes with their amounts, and lists its own times by time", () => {
    expect(
      initialSlots(
        {
          type: "scheduled",
          slots: [
            { passId: MORNING, amount: "1000 mg" },
            { passId: EVENING },
            { time: "21:00" },
            { time: "14:00", amount: "2 tablets" },
          ],
        },
        passes,
      ),
    ).toEqual({
      passes: { [MORNING]: { amount: "1000 mg" }, [EVENING]: { amount: "" } },
      times: [
        { key: 0, value: "14:00", amount: "2 tablets" },
        { key: 1, value: "21:00", amount: "" },
      ],
      unknown: [],
    });
  });

  it("reads a deleted pass as its last time, and keeps a pass it doesn't know", () => {
    expect(
      initialSlots(
        { type: "scheduled", slots: [{ passId: NIGHT, amount: "5 mg" }, { passId: ELSEWHERE }] },
        passes,
      ),
    ).toEqual({ passes: {}, times: [{ key: 0, value: "22:00", amount: "5 mg" }], unknown: [ELSEWHERE] });
  });
});
