import { describe, expect, it } from "vitest";
import { periodMarkers } from "./periodMarkers";
import { periodSpans } from "@caretook/data/domain";

const period = (id: string, startedAt: string, createdAt = startedAt, deletedAt: string | null = null) => ({
  id,
  startedAt,
  createdAt,
  deletedAt,
});

// Home, then Hospital, then Rehab, then Home again.
const SPANS = periodSpans([
  period("home", "2026-09-01T07:00:00.000Z"),
  period("hospital", "2026-10-20T21:20:00.000Z"),
  period("rehab", "2026-10-28T18:00:00.000Z"),
  period("home2", "2026-11-12T19:00:00.000Z"),
]);

const ids = (markers: { id: string; from: { id: string } | null }[]) =>
  markers.map((m) => `${m.from?.id ?? "-"}→${m.id}`);

describe("periodMarkers", () => {
  it("is empty with no periods", () => {
    expect(periodMarkers([], { oldestLoaded: null, hasOlder: false })).toEqual([]);
  });

  it("gives every period a marker from the one before, newest first, the first with none", () => {
    const markers = periodMarkers(SPANS, { oldestLoaded: "2026-11-18T00:00:00.000Z", hasOlder: false });
    expect(ids(markers)).toEqual(["rehab→home2", "hospital→rehab", "home→hospital", "-→home"]);
    expect(markers[0]!.at).toBe("2026-11-12T19:00:00.000Z");
    expect(markers.at(-1)!.from).toBeNull();
  });

  it("while older entries wait, shows only markers at or after the oldest loaded entry", () => {
    expect(ids(periodMarkers(SPANS, { oldestLoaded: "2026-10-28T18:00:00.000Z", hasOlder: true }))).toEqual([
      "rehab→home2",
      "hospital→rehab",
    ]);
    expect(ids(periodMarkers(SPANS, { oldestLoaded: "2026-11-15T00:00:00.000Z", hasOlder: true }))).toEqual(
      [],
    );
  });

  it("shows older markers once the timeline has reached its beginning", () => {
    // The oldest entry is in rehab; Home and Hospital started before any entry.
    expect(ids(periodMarkers(SPANS, { oldestLoaded: "2026-11-01T00:00:00.000Z", hasOlder: false }))).toEqual([
      "rehab→home2",
      "hospital→rehab",
      "home→hospital",
      "-→home",
    ]);
  });

  it("shows every marker on a timeline with no entries, and none while nothing is loaded yet", () => {
    expect(periodMarkers(SPANS, { oldestLoaded: null, hasOlder: false })).toHaveLength(4);
    expect(periodMarkers(SPANS, { oldestLoaded: null, hasOlder: true })).toEqual([]);
  });

  it("shows none under a filter that matches nothing, but every one under a filter with entries", () => {
    expect(periodMarkers(SPANS, { oldestLoaded: null, hasOlder: false, filtered: true })).toEqual([]);
    expect(
      periodMarkers(SPANS, { oldestLoaded: "2026-11-15T00:00:00.000Z", hasOlder: false, filtered: true }),
    ).toHaveLength(4);
  });

  it("keeps both periods that start together, the later-created one newer", () => {
    const spans = periodSpans([
      period("home", "2026-09-01T07:00:00.000Z"),
      period("er", "2026-10-20T21:20:00.000Z", "2026-10-20T21:21:00.000Z"),
      period("hospital", "2026-10-20T21:20:00.000Z", "2026-10-20T21:30:00.000Z"),
    ]);
    const markers = periodMarkers(spans, { oldestLoaded: null, hasOlder: false });
    expect(ids(markers)).toEqual(["er→hospital", "home→er", "-→home"]);
    expect(markers[0]!.at).toBe(markers[1]!.at);
  });

  it("skips deleted periods: the next marker comes from the one before", () => {
    const spans = periodSpans([
      period("home", "2026-09-01T07:00:00.000Z"),
      period("er", "2026-10-20T21:20:00.000Z", undefined, "2026-10-21T00:00:00.000Z"),
      period("hospital", "2026-10-21T02:00:00.000Z"),
    ]);
    expect(ids(periodMarkers(spans, { oldestLoaded: null, hasOlder: false }))).toEqual([
      "home→hospital",
      "-→home",
    ]);
  });
});
