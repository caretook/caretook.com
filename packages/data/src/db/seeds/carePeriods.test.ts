import { describe, expect, it } from "vitest";
import {
  carePeriodContentZSchema,
  carePeriodStartIssue,
  periodSpans,
  SERVER_FUTURE_SKEW_MS,
} from "../schema";
import { seedRows } from "./carePeriods";
import { seedRows as providerRows } from "./providers";

// Seeds write straight to the tables, skipping the services' validation, so
// check them against the same rules the API enforces.

const NOW = Date.UTC(2026, 10, 17, 20, 0);
const ZONE = "America/Los_Angeles";

describe("care period seeds", () => {
  it("are valid periods, stored exactly as the schema would", () => {
    for (const { content } of seedRows(NOW)) {
      expect(carePeriodContentZSchema.parse(content)).toEqual(content);
      expect(
        carePeriodStartIssue(content, { now: new Date(NOW), skewMs: SERVER_FUTURE_SKEW_MS, timeZone: ZONE }),
      ).toBeNull();
    }
  });

  it("are at providers in Dev Family", () => {
    const devFamily = providerRows()[0]!.rows;
    for (const { content } of seedRows(NOW).filter((r) => r.content.placeProviderId)) {
      expect(devFamily.map((p) => p.id)).toContain(content.placeProviderId);
    }
  });

  it("make a track in list order", () => {
    const rows = seedRows(NOW).map((r) => ({
      id: r.id,
      ...r.content,
      createdAt: r.content.startedAt,
      deletedAt: null,
    }));
    const spans = periodSpans(rows);
    expect(spans.map((s) => s.period.id)).toEqual(rows.map((r) => r.id));
  });
});
