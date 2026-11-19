import { describe, expect, it } from "vitest";
import { doseFromForm, dosePatchFromForm, DOSE_STATUS_OPTIONS } from "./doseFormData";

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
      note: null,
      occurredAt: "2026-11-17T16:05:00.000Z",
    });
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
