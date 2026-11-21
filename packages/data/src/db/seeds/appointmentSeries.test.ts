import { describe, expect, it } from "vitest";
import { appointmentSeriesContentZSchema, repeatText, timelineEntryContentZSchema } from "../schema";
import { DEV_FAMILY_SERIES, seriesRows } from "./appointmentSeries";

// Seeds write straight to the tables, skipping the services, so check them
// against the same rules the API enforces, at any seeding time.
describe("series seeds", () => {
  const now = Date.now();
  const groups = seriesRows(now);

  it("are valid series, with valid visits", () => {
    for (const { series, visits } of groups) {
      const { id: _id, groupId: _g, recipientId: _r, ...content } = series;
      expect(appointmentSeriesContentZSchema.safeParse(content).error?.issues ?? []).toEqual([]);
      for (const visit of visits)
        expect(timelineEntryContentZSchema.safeParse(visit.content).error?.issues ?? []).toEqual([]);
    }
  });

  it("give dialysis Mon, Wed and Fri with no end, twelve PT visits with one moved", () => {
    const [dialysis, pt] = groups;
    expect(repeatText({ ...dialysis!.series, startTime: dialysis!.series.startTime ?? null })).toBe(
      "Every Mon, Wed, Fri at 6:00",
    );
    expect(dialysis!.visits.length).toBeGreaterThan(36);
    expect(dialysis!.links.length).toBe(dialysis!.visits.length);
    expect(pt!.visits).toHaveLength(12);
    expect(pt!.visits.filter((v) => v.content.seriesDetached)).toHaveLength(1);
    expect(DEV_FAMILY_SERIES.map((s) => s.key)).toEqual(["dialysis", "pt"]);
    expect(DEV_FAMILY_SERIES.every((s) => s.content.kind === "event")).toBe(true);
  });

  it("have one visit per series day, ids unique", () => {
    const ids = groups.flatMap((g) => g.visits.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const { visits } of groups) {
      const days = visits.map((v) => v.content.seriesDay);
      expect(new Set(days).size).toBe(days.length);
    }
  });
});
