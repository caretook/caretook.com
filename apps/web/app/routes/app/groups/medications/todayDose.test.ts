import { describe, expect, it } from "vitest";
import { todayDoseFields, todayDoseFromForm } from "./todayDose";

const M = "11111111-2222-4333-8444-555555555555";
const PASS = "11111111-2222-4333-8444-666666666666";

const formOf = (fields: Record<string, string>) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
};

describe("todayDose", () => {
  it("round-trips a slot's dose", () => {
    const fields = todayDoseFields({
      medicationId: M,
      status: "given",
      scheduledFor: "08:00",
      passId: PASS,
      amount: " 1 tablet ",
    });
    expect(fields).toEqual({
      intent: "logDose",
      medicationId: M,
      status: "given",
      scheduledFor: "08:00",
      passId: PASS,
      amount: "1 tablet",
      note: "",
    });
    expect(todayDoseFromForm(formOf(fields))).toEqual({
      medicationId: M,
      status: "given",
      scheduledFor: "08:00",
      passId: PASS,
      amount: "1 tablet",
      note: null,
    });
  });

  it("reads a skipped dose with a note and no slot", () => {
    const fields = todayDoseFields({ medicationId: M, status: "skipped", note: "Asleep" });
    expect(todayDoseFromForm(formOf(fields))).toMatchObject({
      status: "skipped",
      scheduledFor: null,
      passId: null,
      note: "Asleep",
    });
  });

  it("ignores another intent", () => {
    expect(todayDoseFromForm(formOf({ intent: "other" }))).toBeNull();
  });
});
