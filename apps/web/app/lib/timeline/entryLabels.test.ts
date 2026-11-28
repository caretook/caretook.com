import { describe, expect, it } from "vitest";
import { formatTime } from "../core/format";
import { actionsLabel, emptyTimelineText, entryLabel, openLabel, rowDayLabel } from "./entryLabels";

const AT = "2026-11-17T17:30:00.000Z";
const time = formatTime(AT);

describe("entryLabel", () => {
  it("uses the title", () => {
    expect(entryLabel({ kind: "event", title: "PT visit", occurredAt: AT })).toBe(`PT visit at ${time}`);
  });
  it("falls back to the kind, lower case", () => {
    expect(entryLabel({ kind: "note", title: null, occurredAt: AT })).toBe(`note at ${time}`);
    expect(entryLabel({ kind: "vital", title: "", occurredAt: AT })).toBe(`vitals at ${time}`);
  });
});

describe("rowDayLabel", () => {
  const NOW = new Date("2026-11-17T20:00:00.000Z");
  const LA = "America/Los_Angeles";
  it("says Today, Yesterday or Tomorrow near now", () => {
    expect(rowDayLabel("2026-11-17T17:30:00.000Z", LA, NOW)).toBe("Today");
    expect(rowDayLabel("2026-11-16T17:30:00.000Z", LA, NOW)).toBe("Yesterday");
    expect(rowDayLabel("2026-11-18T17:30:00.000Z", LA, NOW)).toBe("Tomorrow");
  });
  it("gives a short date, with the year only in another year, in the zone", () => {
    expect(rowDayLabel("2026-06-09T17:30:00.000Z", LA, NOW)).toBe("Jun 9");
    expect(rowDayLabel("2025-06-09T17:30:00.000Z", LA, NOW)).toBe("Jun 9, 2025");
    // 2 AM UTC on Jun 10 is still Jun 9 in Los Angeles.
    expect(rowDayLabel("2026-06-10T02:00:00.000Z", LA, NOW)).toBe("Jun 9");
  });
});

describe("openLabel", () => {
  it("opens a page, or edits in the sheet", () => {
    const note = { kind: "note", title: "Lunch", occurredAt: AT } as const;
    expect(openLabel(note, false)).toBe(`Open Lunch at ${time}`);
    expect(openLabel({ ...note, kind: "symptom", title: null }, true)).toBe(`Edit symptom at ${time}`);
  });
});

describe("actionsLabel", () => {
  it("names the kind, never the title", () => {
    expect(actionsLabel({ kind: "event", title: "PT visit", occurredAt: AT })).toBe(
      `Actions for event at ${time}`,
    );
  });
});

describe("emptyTimelineText", () => {
  it("names a tag beside the other filters", () => {
    expect(emptyTimelineText(null, null, null, null, null, "Knee")).toBe(
      "No entries tagged “Knee” on the timeline yet.",
    );
    expect(emptyTimelineText("note", "Sam Lee", null, null, null, "Knee")).toBe(
      "No notes tagged “Knee” by Sam Lee yet.",
    );
    expect(emptyTimelineText(null, null, "walk", null, null, "Knee")).toBe(
      "No entries tagged “Knee” match “walk”.",
    );
  });

  it("with and without a filter", () => {
    expect(emptyTimelineText(null)).toBe("Nothing on the timeline yet.");
    expect(emptyTimelineText("symptom")).toBe("No symptoms on the timeline yet.");
    expect(emptyTimelineText("vital")).toBe("No vitals on the timeline yet.");
  });
  it("names the author filter, alone and with a kind", () => {
    expect(emptyTimelineText(null, "Alex Rivera")).toBe("No entries by Alex Rivera yet.");
    expect(emptyTimelineText("symptom", "Alex Rivera")).toBe("No symptoms by Alex Rivera yet.");
    expect(emptyTimelineText("note", "Former member")).toBe("No notes by Former member yet.");
  });
  it("names the search, with the other filters", () => {
    expect(emptyTimelineText(null, null, "fall")).toBe("No entries match “fall”.");
    expect(emptyTimelineText("symptom", "Alex Rivera", "pain")).toBe(
      "No symptoms by Alex Rivera match “pain”.",
    );
    expect(emptyTimelineText("note", undefined, "")).toBe("No notes on the timeline yet.");
  });
  it("names the vital type", () => {
    expect(emptyTimelineText("vital", null, null, "bloodPressure")).toBe(
      "No blood pressure readings on the timeline yet.",
    );
    expect(emptyTimelineText("vital", "Alex Rivera", null, "spo2")).toBe(
      "No oxygen (SpO₂) readings by Alex Rivera yet.",
    );
    expect(emptyTimelineText("vital", null, "low", "weight")).toBe("No weight readings match “low”.");
    expect(emptyTimelineText("symptom", null, null, "weight")).toBe("No symptoms on the timeline yet.");
  });
  it("names the chosen symptom types", () => {
    expect(emptyTimelineText("symptom", null, null, null, ["Pain"])).toBe("No pain on the timeline yet.");
    expect(emptyTimelineText("symptom", null, null, null, ["Pain", "Nausea"])).toBe(
      "No pain or nausea on the timeline yet.",
    );
    expect(emptyTimelineText("symptom", "Alex Rivera", null, null, ["Fall", "Knee pain", "Nausea"])).toBe(
      "No fall, knee pain or nausea by Alex Rivera yet.",
    );
    expect(emptyTimelineText("symptom", null, "night", null, ["Nausea"])).toBe("No nausea match “night”.");
    expect(emptyTimelineText("symptom", null, null, null, [])).toBe("No symptoms on the timeline yet.");
    expect(emptyTimelineText("note", null, null, null, ["Nausea"])).toBe("No notes on the timeline yet.");
  });
  it("no author name is no author filter", () => {
    expect(emptyTimelineText("event", null)).toBe("No events on the timeline yet.");
    expect(emptyTimelineText(null, null)).toBe("Nothing on the timeline yet.");
  });
});
