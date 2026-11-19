import type { CarePeriodType } from "@caretook/data/schema";

import { periodSpans } from "@caretook/data/schema";
import { describe, expect, it } from "vitest";
import { suggestionText } from "./periodDisplay";
import { suggestedType, suggestPeriod } from "./periodSuggestions";

const NOW = Date.parse("2026-11-19T18:00:00Z");
const EVENT_AT = "2026-11-15T14:20:00.000Z";

const period = (id: string, type: CarePeriodType, startedAt: string, deletedAt: string | null = null) => ({
  id,
  type,
  startedAt,
  createdAt: startedAt,
  deletedAt,
});

const practice = (id: string, deletedAt: string | null = null) => ({
  id,
  type: "practice" as const,
  deletedAt,
});

const suggest = (title: string, extra: Partial<Parameters<typeof suggestPeriod>[0]> = {}) =>
  suggestPeriod({ title, occurredAt: EVENT_AT, spans: [], providers: [], now: NOW, ...extra });

describe("period suggestions: the title's words", () => {
  it.each<[string, CarePeriodType]>([
    ["Admitted to Mercy General", "hospital"],
    ["Readmitted overnight", "hospital"],
    ["Hospitalized with pneumonia", "hospital"],
    ["Taken to the hospital", "hospital"],
    ["Discharged home", "home"],
    ["Discharged to home", "home"],
    ["Back home at last", "home"],
    ["Home from the hospital", "home"],
    ["Went to the ER", "emergency"],
    ["Emergency room visit", "emergency"],
    ["Kept for observation", "emergency"],
    ["Moved to rehab", "rehab"],
    ["Transferred to skilled nursing", "rehab"],
    ["SNF admission", "rehab"],
    ["Moved into assisted living", "assistedLiving"],
    ["Memory care move-in", "memoryCare"],
    ["Moved to a nursing home", "nursingHome"],
    ["Long-term care placement", "nursingHome"],
    ["Hospice intake", "hospiceHome"],
    ["Home hospice started", "hospiceHome"],
    ["Hospice at home begins", "hospiceHome"],
    ["Moved to the hospice house", "hospiceFacility"],
    ["Inpatient hospice", "hospiceFacility"],
    ["Hospice facility admission", "hospiceFacility"],
  ])("%s → %s", (title, type) => {
    expect(suggestedType(title)).toBe(type);
  });

  it("ignores case and accents", () => {
    expect(suggestedType("ADMITTED")).toBe("hospital");
    expect(suggestedType("Admítted to Mercy")).toBe("hospital");
    expect(suggestedType("réhab day one")).toBe("rehab");
    expect(suggestedType("dIsChArGeD HoMe")).toBe("home");
  });

  it("matches whole words only", () => {
    expect(suggestedType("Rehabbed the porch")).toBeNull();
    expect(suggestedType("Ernest visited")).toBeNull();
    expect(suggestedType("Water heater fixed")).toBeNull();
    expect(suggestedType("Admittedly a long day")).toBeNull();
    expect(suggestedType("Hospiceworks fundraiser")).toBeNull();
  });

  it("offers nothing for titles that don't say a move", () => {
    expect(suggestedType(null)).toBeNull();
    expect(suggestedType("")).toBeNull();
    expect(suggestedType("Event")).toBeNull();
    expect(suggestedType("Cardiology follow-up")).toBeNull();
    expect(suggestedType("Hospital follow-up")).toBeNull();
    expect(suggestedType("Discharged")).toBeNull();
    expect(suggestedType("Home")).toBeNull();
  });

  it("skips where they came from and where they didn't go", () => {
    expect(suggestedType("Discharged home from rehab")).toBe("home");
    expect(suggestedType("Transferred from the hospital to rehab")).toBe("rehab");
    expect(suggestedType("Back from the ER")).toBeNull();
    expect(suggestedType("No ER visit needed")).toBeNull();
    expect(suggestedType("Outpatient rehab session")).toBeNull();
  });

  it("prefers a place to a bare admission, and the last place to earlier ones", () => {
    expect(suggestedType("Rehab admission")).toBe("rehab");
    expect(suggestedType("Admitted to rehab")).toBe("rehab");
    expect(suggestedType("ER, then to the hospital")).toBe("hospital");
    expect(suggestedType("Discharged to home hospice")).toBe("hospiceHome");
  });
});

describe("period suggestions: when to offer", () => {
  it("prefills the event's time and its first linked practice", () => {
    expect(
      suggest("Admitted to Mercy General", {
        providers: [{ id: "doc", type: "clinician", deletedAt: null }, practice("p1"), practice("p2")],
      }),
    ).toEqual({ type: "hospital", startsAt: EVENT_AT, dateOnly: false, placeProviderId: "p1" });
  });

  it("skips a removed practice, and has no place without one", () => {
    expect(suggest("Admitted", { providers: [practice("gone", "2026-11-16T00:00:00Z")] })).toMatchObject({
      placeProviderId: null,
    });
    expect(
      suggest("Admitted", { providers: [practice("gone", "2026-11-16T00:00:00Z"), practice("p")] }),
    ).toMatchObject({ placeProviderId: "p" });
    expect(suggest("Admitted")).toMatchObject({ placeProviderId: null });
  });

  it("never puts a practice as the place of a home period", () => {
    expect(suggest("Discharged home", { providers: [practice("p")] })).toMatchObject({
      type: "home",
      placeProviderId: null,
    });
    expect(suggest("Hospice intake", { providers: [practice("p")] })).toMatchObject({
      type: "hospiceHome",
      placeProviderId: null,
    });
  });

  it("starts an all-day event's period on its date", () => {
    expect(suggest("Moved to rehab", { allDay: true })).toMatchObject({ dateOnly: true });
  });

  it("is suppressed when the period at the event's time already has that type", () => {
    const spans = periodSpans([
      period("h", "home", "2026-10-01T00:00:00Z"),
      period("x", "hospital", "2026-11-14T00:00:00Z"),
      period("r", "rehab", "2026-11-17T00:00:00Z"),
    ]);
    expect(suggest("Admitted to Mercy General", { spans })).toBeNull();
    // Another type at that time, or the same type at another time, still offers.
    expect(suggest("Moved to rehab", { spans })).toMatchObject({ type: "rehab" });
    expect(suggest("Admitted", { spans, occurredAt: "2026-11-01T00:00:00.000Z" })).toMatchObject({
      type: "hospital",
    });
  });

  it("counts a period starting at the event's time (inclusive start), and not a deleted one", () => {
    const at = periodSpans([period("x", "hospital", EVENT_AT)]);
    expect(suggest("Admitted", { spans: at })).toBeNull();
    const deleted = periodSpans([period("x", "hospital", "2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")]);
    expect(suggest("Admitted", { spans: deleted })).toMatchObject({ type: "hospital" });
  });

  it("offers before the first period", () => {
    const spans = periodSpans([period("h", "hospital", "2026-11-18T00:00:00Z")]);
    expect(suggest("Admitted", { spans })).toMatchObject({ type: "hospital" });
  });

  it("offers nothing for a future event or a bad time", () => {
    expect(suggest("Admitted", { occurredAt: "2026-11-25T09:00:00.000Z" })).toBeNull();
    expect(suggest("Admitted", { occurredAt: "soon" })).toBeNull();
  });
});

describe("period suggestions: the chip's words", () => {
  it("asks with the type's short name and the right article", () => {
    expect(suggestionText("hospital")).toBe("Start a hospital period?");
    expect(suggestionText("home")).toBe("Start a home period?");
    expect(suggestionText("emergency")).toBe("Start an emergency room period?");
    expect(suggestionText("assistedLiving")).toBe("Start an assisted living period?");
    expect(suggestionText("hospiceHome")).toBe("Start a hospice at home period?");
  });
});
