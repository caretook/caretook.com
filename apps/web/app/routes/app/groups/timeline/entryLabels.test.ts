import { describe, expect, it } from "vitest";
import { formatTime } from "../../../../lib/format";
import { actionsLabel, emptyTimelineText, entryLabel, openLabel } from "./entryLabels";

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
  it("with and without a filter", () => {
    expect(emptyTimelineText(null)).toBe("Nothing on the timeline yet.");
    expect(emptyTimelineText("symptom")).toBe("No symptoms on the timeline yet.");
    expect(emptyTimelineText("vital")).toBe("No vitals on the timeline yet.");
  });
});
