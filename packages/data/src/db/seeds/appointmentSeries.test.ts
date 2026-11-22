import { describe, expect, it } from "vitest";
import { appointmentSeriesContentZSchema, timelineEntryContentZSchema } from "../schema";
import { seriesRows } from "./appointmentSeries";

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

  it("have one visit per series day, ids unique, and link only their own visits", () => {
    const ids = groups.flatMap((g) => g.visits.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const { visits, links } of groups) {
      const visitIds = new Set(visits.map((v) => v.id));
      for (const link of links) expect(visitIds.has(link.entryId)).toBe(true);
      const days = visits.map((v) => v.content.seriesDay);
      expect(new Set(days).size).toBe(days.length);
    }
  });
});
