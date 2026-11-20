import { describe, expect, it } from "vitest";
import {
  addableMedications,
  doseField,
  DOSE_IDS_FIELD,
  passLogJoin,
  passLogPatchesFromForm,
  passSheetGuard,
} from "./passSheet";

const G = "g1";

describe("passSheetGuard", () => {
  it("opens a writer's log that still has a dose", () => {
    expect(passSheetGuard({ groupId: G, passLogId: "L", liveDoses: 2, search: "", canWrite: true })).toEqual({
      sheet: { passLogId: "L" },
    });
  });

  it("sends viewers and missing or fully deleted logs to the timeline, filters kept", () => {
    const timeline = { redirect: `/app/groups/${G}/timeline?kind=dose` };
    expect(
      passSheetGuard({ groupId: G, passLogId: "L", liveDoses: 2, search: "?kind=dose", canWrite: false }),
    ).toEqual(timeline);
    expect(
      passSheetGuard({
        groupId: G,
        passLogId: "L",
        liveDoses: 0,
        search: "?kind=dose&type=spo2",
        canWrite: true,
      }),
    ).toEqual(timeline);
  });
});

describe("passLogPatchesFromForm", () => {
  it("reads one patch per listed dose; blanks clear, a bad time is empty", () => {
    const form = new FormData();
    form.append(DOSE_IDS_FIELD, "a");
    form.append(DOSE_IDS_FIELD, "b");
    form.set(doseField("status", "a"), "given");
    form.set(doseField("amount", "a"), " 2 tablets ");
    form.set(doseField("note", "a"), "");
    form.set(doseField("occurredAt", "a"), "2026-11-17T08:05:00-08:00[America/Los_Angeles]");
    form.set(doseField("status", "b"), "refused");
    form.set(doseField("amount", "b"), "");
    form.set(doseField("note", "b"), "Spat it out");
    form.set(doseField("occurredAt", "b"), "nonsense");
    expect(passLogPatchesFromForm(form)).toEqual([
      {
        id: "a",
        patch: { status: "given", amount: "2 tablets", note: null, occurredAt: "2026-11-17T16:05:00.000Z" },
      },
      { id: "b", patch: { status: "refused", amount: null, note: "Spat it out", occurredAt: "" } },
    ]);
  });
});

describe("passLogJoin and addableMedications", () => {
  const doses = [
    {
      occurredAt: "2026-11-17T16:07:00Z",
      details: { medicationId: "m2", passLogId: "L", scheduledFor: "08:00" },
    },
    {
      occurredAt: "2026-11-17T16:05:00Z",
      details: { medicationId: "m1", passLogId: "L", passId: "P", scheduledFor: "08:00" },
    },
  ];

  it("joins the round at its earliest time, with its pass and slot", () => {
    expect(passLogJoin("L", doses)).toEqual({
      passLogId: "L",
      passId: "P",
      scheduledFor: "08:00",
      occurredAt: "2026-11-17T16:05:00Z",
    });
    expect(passLogJoin("L", [])).toBeNull();
  });

  it("offers only medications not in the log", () => {
    expect(addableMedications([{ id: "m1" }, { id: "m3" }, { id: "m2" }, { id: "m4" }], doses)).toEqual([
      { id: "m3" },
      { id: "m4" },
    ]);
  });
});
