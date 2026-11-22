import type { DoseSlot } from "../../../../lib/medications/dueDoses";

import { describe, expect, it } from "vitest";
import {
  doseFromForm,
  dosePatchFromForm,
  doseSheetOptions,
  DOSE_STATUS_OPTIONS,
  NEW_MEDICATION_OPTION,
  parseDoseOption,
  quickAddFromForm,
} from "./doseFormData";

const M = "11111111-2222-4333-8444-555555555555";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("doseFromForm", () => {
  it("reads a new dose, with the time in UTC", () => {
    expect(
      doseFromForm(
        form({
          medicationId: M,
          status: "given",
          amount: " 1 tablet ",
          scheduledFor: "08:00",
          note: "",
          occurredAt: "2026-11-17T08:05:00-08:00[America/Los_Angeles]",
        }),
      ),
    ).toEqual({
      medicationId: M,
      status: "given",
      amount: "1 tablet",
      scheduledFor: "08:00",
      passId: null,
      note: null,
      occurredAt: "2026-11-17T16:05:00.000Z",
    });
  });

  it("reads a slot's pass with the slot only", () => {
    const PASS = "0b6f3c1e-5d1a-4c2e-9a77-3f1d2b9d1001";
    expect(doseFromForm(form({ medicationId: `${M}@08:00`, status: "given", passId: PASS }))).toMatchObject({
      medicationId: M,
      scheduledFor: "08:00",
      passId: PASS,
    });
    expect(doseFromForm(form({ medicationId: M, status: "given", passId: PASS })).passId).toBeNull();
  });

  it("leaves blanks null and an unreadable time empty, for the write to refuse", () => {
    const dose = doseFromForm(form({ medicationId: M, status: "skipped", occurredAt: "soon" }));
    expect(dose).toMatchObject({ amount: null, scheduledFor: null, note: null, occurredAt: "" });
  });
});

describe("dosePatchFromForm", () => {
  it("reads an edit, clearing a blank amount", () => {
    expect(
      dosePatchFromForm(
        form({
          status: "refused",
          amount: "",
          note: "Spat it out",
          occurredAt: "2026-11-17T20:00:00-08:00[America/Los_Angeles]",
        }),
      ),
    ).toEqual({
      status: "refused",
      amount: null,
      note: "Spat it out",
      occurredAt: "2026-11-18T04:00:00.000Z",
    });
  });
});

describe("DOSE_STATUS_OPTIONS", () => {
  it("offers given, skipped and refused, in that order", () => {
    expect(DOSE_STATUS_OPTIONS.map((o) => o.label)).toEqual(["Given", "Skipped", "Refused"]);
  });
});

describe("doseSheetOptions", () => {
  const A = "aaaaaaaa-2222-4333-8444-555555555555";
  const B = "bbbbbbbb-2222-4333-8444-555555555555";
  const choices = [
    { id: B, name: "Lisinopril", strength: "10 mg", dose: "1 tablet" },
    { id: A, name: "Metformin", strength: "500 mg", dose: "2 tablets" },
  ];
  const slot = (id: string, time: string, state: "due" | "overdue" | "upcoming" | "given") =>
    ({ medication: { id }, time, state }) as unknown as DoseSlot;

  it("lists due slots first, then every medication, then + New medication", () => {
    const { options, initial } = doseSheetOptions(
      choices,
      { slots: [slot(A, "08:00", "overdue"), slot(B, "08:00", "given"), slot(A, "20:00", "due")] },
      { medicationId: null, slot: null },
    );
    expect(options.map((o) => [o.value, o.label, o.dose])).toEqual([
      [`${A}@08:00`, "Metformin 500 mg · 8:00 dose, overdue", "2 tablets"],
      [`${A}@20:00`, "Metformin 500 mg · 20:00 dose", "2 tablets"],
      [B, "Lisinopril 10 mg", "1 tablet"],
      [A, "Metformin 500 mg", "2 tablets"],
      [NEW_MEDICATION_OPTION, "+ New medication", null],
    ]);
    expect(initial).toBe(`${A}@08:00`);
    expect(parseDoseOption(`${A}@08:00`)).toEqual({ medicationId: A, slot: "08:00" });
    expect(parseDoseOption(B)).toEqual({ medicationId: B, slot: null });
  });

  it("starts on the slot it was opened for, even one that isn't due", () => {
    const { options, initial } = doseSheetOptions(
      choices,
      { slots: [slot(A, "20:00", "upcoming")] },
      { medicationId: A, slot: "20:00" },
    );
    expect(options[0]).toMatchObject({ value: `${A}@20:00`, label: "Metformin 500 mg · 20:00 dose" });
    expect(initial).toBe(`${A}@20:00`);
    expect(doseSheetOptions(choices, { slots: [] }, { medicationId: B, slot: null }).initial).toBe(B);
  });

  it("leaves out due slots of the passes shown above it, unless asked for", () => {
    const P = "cccccccc-2222-4333-8444-555555555555";
    const inPass = (id: string, time: string) => ({ ...slot(id, time, "due"), passId: P }) as DoseSlot;
    const due = { slots: [inPass(A, "08:00"), inPass(B, "08:00"), slot(A, "09:00", "due")] };
    const shown = new Set([P]);
    expect(doseSheetOptions(choices, due, { medicationId: null, slot: null }, shown).options[0]?.value).toBe(
      `${A}@09:00`,
    );
    expect(
      doseSheetOptions(choices, due, { medicationId: B, slot: "08:00" }, shown).options.map((o) => o.value),
    ).toEqual([`${B}@08:00`, `${A}@09:00`, B, A, NEW_MEDICATION_OPTION]);
  });

  it("with no current medications, + New medication is the only choice, and the one to start on", () => {
    expect(doseSheetOptions([], { slots: [] }, { medicationId: null, slot: null })).toMatchObject({
      options: [{ value: NEW_MEDICATION_OPTION, label: "+ New medication" }],
      initial: NEW_MEDICATION_OPTION,
    });
  });
});

describe("quickAddFromForm", () => {
  it("reads the new medication's name, dose and type, and its dose without a medication", () => {
    expect(
      quickAddFromForm(
        form({
          medicationId: NEW_MEDICATION_OPTION,
          name: " Ibuprofen ",
          dose: " 2 tablets ",
          type: "otc",
          status: "given",
          amount: "2 tablets",
          note: "",
          occurredAt: "2026-11-17T08:05:00-08:00[America/Los_Angeles]",
        }),
      ),
    ).toEqual({
      medication: { name: " Ibuprofen ", dose: "2 tablets", type: "otc" },
      dose: {
        status: "given",
        amount: "2 tablets",
        scheduledFor: null,
        passId: null,
        note: null,
        occurredAt: "2026-11-17T16:05:00.000Z",
      },
    });
  });

  it("leaves a blank dose and type null, for the write to refuse the type", () => {
    expect(
      quickAddFromForm(form({ medicationId: NEW_MEDICATION_OPTION, status: "given" }))?.medication,
    ).toEqual({
      name: "",
      dose: null,
      type: null,
    });
  });

  it("is null for a medication on the list", () => {
    expect(quickAddFromForm(form({ medicationId: M, status: "given", name: "Stray" }))).toBeNull();
  });
});

describe("doseFromForm with a slot choice", () => {
  it("reads the medication and the slot from one choice", () => {
    const data = new FormData();
    data.set("medicationId", `${M}@20:00`);
    data.set("status", "given");
    data.set("occurredAt", "2026-11-17T20:05:00-08:00[America/Los_Angeles]");
    expect(doseFromForm(data)).toMatchObject({ medicationId: M, scheduledFor: "20:00" });
  });
});
