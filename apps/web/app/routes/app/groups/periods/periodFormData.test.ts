import { describe, expect, it } from "vitest";
import { FIELD, isFieldIssue, parseStart, periodFromForm } from "./periodFormData";

const LA = "America/Los_Angeles";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("parseStart", () => {
  it("reads the date field's zoned value as ISO", () => {
    expect(parseStart("2026-11-12T14:20:00-08:00[America/Los_Angeles]", false, LA)).toBe(
      "2026-11-12T22:20:00.000Z",
    );
  });

  it("moves a date-only start to the start of its day in the recipient's zone", () => {
    expect(parseStart("2026-11-12T14:20:00-08:00[America/Los_Angeles]", true, LA)).toBe(
      "2026-11-12T08:00:00.000Z",
    );
    // 23:30 on Nov 12 in New York is Nov 12, in the field's zone.
    expect(parseStart("2026-11-12T23:30:00-05:00[America/New_York]", true, "America/New_York")).toBe(
      "2026-11-12T05:00:00.000Z",
    );
  });

  it("is empty for a missing or malformed value", () => {
    expect(parseStart("", false, LA)).toBe("");
    expect(parseStart("yesterday", true, LA)).toBe("");
  });
});

describe("periodFromForm", () => {
  it("reads every field, empty text as none", () => {
    expect(
      periodFromForm(
        form({
          [FIELD.type]: "hospital",
          [FIELD.label]: " Cardiac unit ",
          [FIELD.placeProviderId]: "p1",
          [FIELD.newPlace]: "",
          [FIELD.placeDetail]: "",
          [FIELD.startedAt]: "2026-11-12T14:20:00-08:00[America/Los_Angeles]",
        }),
        LA,
      ),
    ).toEqual({
      input: {
        type: "hospital",
        label: "Cardiac unit",
        placeProviderId: "p1",
        placeDetail: null,
        startedAt: "2026-11-12T22:20:00.000Z",
        dateOnly: false,
      },
      newPlace: null,
    });
  });

  it("takes a new place by name instead of a chosen one, and the date-only box", () => {
    const { input, newPlace } = periodFromForm(
      form({
        [FIELD.type]: "rehab",
        [FIELD.placeProviderId]: "",
        [FIELD.newPlace]: "Oak Hills Rehab",
        [FIELD.startedAt]: "2026-11-02T09:00:00-08:00[America/Los_Angeles]",
        [FIELD.dateOnly]: "on",
      }),
      LA,
    );
    expect(newPlace).toEqual({ name: "Oak Hills Rehab" });
    expect(input).toMatchObject({
      placeProviderId: null,
      dateOnly: true,
      startedAt: "2026-11-02T08:00:00.000Z",
    });
  });

  it("knows which issues belong to a field", () => {
    expect(isFieldIssue("label")).toBe(true);
    expect(isFieldIssue("startedAt")).toBe(true);
    expect(isFieldIssue("groupId")).toBe(false);
  });
});
