import type { PlanSeries, PlanVisit, SeriesEntryWrite, SeriesPlan } from "./seriesEdit";

import { describe, expect, it } from "vitest";
import { seriesVisitId } from "./repeatRule";
import { isPastVisit, planSeriesEdit, ruleFrom, ruleUntil } from "./seriesEdit";
import { seriesVisits } from "./seriesVisits";

// The appointments area's clock: Wed 2026-11-18 10:00 in Los Angeles.
const LA = "America/Los_Angeles";
const NOW = new Date("2026-11-18T18:00:00Z");
const NEW_ID = "00000000-0000-4000-8000-0000000000aa";

/** Dialysis, Mon Wed Fri 6:00 for 4 h, since Mon 2 Nov. */
const dialysis = (over: Partial<PlanSeries> = {}): PlanSeries => ({
  id: "00000000-0000-4000-8000-000000000001",
  groupId: "00000000-0000-4000-8000-000000000002",
  recipientId: "00000000-0000-4000-8000-000000000003",
  kind: "event",
  rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
  startsOn: "2026-11-02",
  startTime: "06:00",
  allDay: false,
  timeZone: LA,
  title: "Dialysis",
  durationMinutes: 240,
  place: "Mercy dialysis",
  providerIds: [],
  toppedUpThrough: "2027-02-16",
  ...over,
});

/** Every visit the series has written, as a device holds them. */
const visitsOf = (series: PlanSeries, through = series.toppedUpThrough!): PlanVisit[] =>
  seriesVisits(series, series.startsOn, through).map((v) => ({
    id: seriesVisitId(series.id, v.day),
    seriesDay: v.day,
    occurredAt: v.start,
    endsAt: v.end,
    allDay: series.allDay,
    title: series.title,
    place: series.place,
    cancelledAt: null,
    detached: false,
    deleted: false,
    touched: false,
  }));

const idOn = (series: PlanSeries, day: string) => seriesVisitId(series.id, day);

const plan = (args: Omit<Parameters<typeof planSeriesEdit>[0], "now" | "newSeriesId">): SeriesPlan => {
  const res = planSeriesEdit({ ...args, now: NOW, newSeriesId: NEW_ID });
  if (!res.ok) throw new Error(res.problem);
  return res.plan;
};

const ops = (p: SeriesPlan, op: SeriesEntryWrite["op"]) => p.entries.filter((e) => e.op === op);
const idsOf = (writes: SeriesEntryWrite[]) => writes.map((w) => w.id);
const writeFor = (p: SeriesPlan, id: string) => p.entries.find((e) => e.id === id);

/** A visit's past ones (started before now) are never written. */
const expectNoPast = (p: SeriesPlan, visits: PlanVisit[]) => {
  const past = new Set(visits.filter((v) => isPastVisit(v, LA, NOW)).map((v) => v.id));
  expect(p.entries.filter((e) => past.has(e.id))).toEqual([]);
};

const FRI = "2026-11-20";

describe("planSeriesEdit: only this visit", () => {
  const series = dialysis();
  const visits = visitsOf(series);
  const id = idOn(series, FRI);

  it("edits the visit and detaches it, nothing else", () => {
    const p = plan({
      series,
      visits,
      visit: id,
      scope: "only",
      change: {
        action: "edit",
        title: "Dialysis (late chair)",
        occurredAt: "2026-11-20T16:00:00.000Z",
        endsAt: "2026-11-20T20:00:00.000Z",
      },
    });
    expect(p).toEqual({
      newSeries: null,
      seriesPatch: null,
      deleteSeries: null,
      entries: [
        {
          op: "update",
          id,
          patch: {
            title: "Dialysis (late chair)",
            occurredAt: "2026-11-20T16:00:00.000Z",
            endsAt: "2026-11-20T20:00:00.000Z",
            seriesDetached: true,
          },
        },
      ],
    });
  });

  it("cancels with a reason and detaches; deletes; reschedules through the ordinary write", () => {
    const cancel = plan({
      series,
      visits,
      visit: id,
      scope: "only",
      change: { action: "cancel", reason: " Closed " },
    });
    expect(cancel.entries).toEqual([
      {
        op: "update",
        id,
        patch: { cancelledAt: NOW.toISOString(), cancelReason: "Closed", seriesDetached: true },
      },
    ]);
    expect(plan({ series, visits, visit: id, scope: "only", change: { action: "delete" } }).entries).toEqual([
      { op: "delete", id },
    ]);
    const moved = plan({
      series,
      visits,
      visit: id,
      scope: "only",
      change: {
        action: "reschedule",
        occurredAt: "2026-11-21T14:00:00.000Z",
        endsAt: "2026-11-21T18:00:00.000Z",
        allDay: false,
        keepOld: true,
      },
    });
    expect(moved.entries).toEqual([
      {
        op: "reschedule",
        id,
        occurredAt: "2026-11-21T14:00:00.000Z",
        endsAt: "2026-11-21T18:00:00.000Z",
        allDay: false,
        keepOld: true,
      },
    ]);
    expect(moved.newSeries).toBeNull();
  });

  it("refuses cancelling or rescheduling a reminder", () => {
    const notes = dialysis({ kind: "note", durationMinutes: null, place: null, title: "Order refills" });
    const res = planSeriesEdit({
      series: notes,
      visits: visitsOf(notes),
      visit: idOn(notes, FRI),
      scope: "only",
      change: { action: "cancel" },
      now: NOW,
      newSeriesId: NEW_ID,
    });
    expect(res).toEqual({ ok: false, problem: "Only events can be cancelled" });
  });
});

describe("planSeriesEdit: this and later (edit)", () => {
  const series = dialysis();
  const visits = visitsOf(series);

  it("a time change splits the series and moves every later visit in place", () => {
    const p = plan({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", startTime: "07:00" },
    });
    expect(p.seriesPatch).toEqual({
      id: series.id,
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261119",
    });
    expect(p.deleteSeries).toBeNull();
    expect(p.newSeries).toMatchObject({
      id: NEW_ID,
      rule: series.rule,
      startsOn: FRI,
      startTime: "07:00",
      durationMinutes: 240,
      title: "Dialysis",
      toppedUpThrough: "2027-02-16",
    });
    const later = visits.filter((v) => v.seriesDay >= FRI);
    expect(idsOf(ops(p, "update"))).toEqual(later.map((v) => v.id));
    expect(ops(p, "delete")).toEqual([]);
    expect(ops(p, "create")).toEqual([]);
    // Fri 20 Nov at 7:00 in Los Angeles is 15:00 UTC, four hours long.
    expect(writeFor(p, idOn(series, FRI))).toEqual({
      op: "update",
      id: idOn(series, FRI),
      patch: {
        seriesId: NEW_ID,
        occurredAt: "2026-11-20T15:00:00.000Z",
        endsAt: "2026-11-20T19:00:00.000Z",
      },
    });
    expectNoPast(p, visits);
  });

  it("a weekday change moves the days still in the rule, deletes the rest, and adds the new ones", () => {
    const p = plan({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,FR" },
    });
    const updated = idsOf(ops(p, "update"));
    expect(updated).toContain(idOn(series, FRI));
    expect(updated).toContain(idOn(series, "2026-11-27"));
    expect(idsOf(ops(p, "delete"))).toContain(idOn(series, "2026-11-23"));
    expect(idsOf(ops(p, "delete"))).toContain(idOn(series, "2026-11-25"));
    const created = ops(p, "create");
    expect(created[0]).toEqual({
      op: "create",
      id: seriesVisitId(NEW_ID, "2026-11-24"),
      seriesId: NEW_ID,
      day: "2026-11-24",
      occurredAt: "2026-11-24T14:00:00.000Z",
      endsAt: "2026-11-24T18:00:00.000Z",
    });
    expect(created.every((c) => c.op === "create" && new Date(`${c.day}T12:00:00Z`).getUTCDay() === 2)).toBe(
      true,
    );
    expectNoPast(p, visits);
  });

  it("a new end: the old series ends the day before, the new one ends on the new date", () => {
    const p = plan({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261204" },
    });
    expect(p.newSeries?.rule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261204");
    const moved = ops(p, "update").map((w) => w.id);
    expect(moved).toHaveLength(7); // 20, 23, 25, 27, 30 Nov, 2, 4 Dec
    expect(ops(p, "delete")).toHaveLength(visits.filter((v) => v.seriesDay > "2026-12-04").length);
  });

  it("keeps detached visits as they are, and keeps touched ones (notes, a todo, a cancel) detached", () => {
    const touched = visits.map((v) =>
      v.seriesDay === "2026-11-23"
        ? { ...v, touched: true }
        : v.seriesDay === "2026-11-25"
          ? { ...v, cancelledAt: "2026-11-17T10:00:00.000Z" }
          : v.seriesDay === "2026-11-27"
            ? { ...v, detached: true, occurredAt: "2026-11-27T20:00:00.000Z" }
            : v,
    );
    const p = plan({
      series,
      visits: touched,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,FR" },
    });
    // Mon 23 (notes) and Wed 25 (cancelled) aren't in the new rule: detached and kept.
    expect(writeFor(p, idOn(series, "2026-11-23"))).toEqual({
      op: "update",
      id: idOn(series, "2026-11-23"),
      patch: { seriesDetached: true },
    });
    expect(writeFor(p, idOn(series, "2026-11-25"))).toEqual({
      op: "update",
      id: idOn(series, "2026-11-25"),
      patch: { seriesDetached: true },
    });
    // Fri 27 was moved on its own: untouched, and its day isn't added again.
    expect(writeFor(p, idOn(series, "2026-11-27"))).toBeUndefined();
    expect(ops(p, "create").some((c) => c.op === "create" && c.day === "2026-11-27")).toBe(false);
  });

  it("doesn't add back a day whose visit was deleted on its own", () => {
    const deleted = visits.map((v) => (v.seriesDay === "2026-11-27" ? { ...v, deleted: true } : v));
    const p = plan({
      series,
      visits: deleted,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", startTime: "07:00" },
    });
    expect(writeFor(p, idOn(series, "2026-11-27"))).toBeUndefined();
    expect(ops(p, "create")).toEqual([]);
  });

  it("brings a detached anchor back into the series", () => {
    const anchor = visits.map((v) => (v.seriesDay === FRI ? { ...v, detached: true } : v));
    const p = plan({
      series,
      visits: anchor,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", title: "Dialysis, chair 4" },
    });
    expect(writeFor(p, idOn(series, FRI))).toEqual({
      op: "update",
      id: idOn(series, FRI),
      patch: { seriesId: NEW_ID, seriesDetached: false, title: "Dialysis, chair 4" },
    });
    expect(p.newSeries?.title).toBe("Dialysis, chair 4");
  });

  it("a time from the entry page's chip gives the series its time of day and length", () => {
    const p = plan({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", occurredAt: "2026-11-20T16:30:00.000Z", endsAt: "2026-11-20T19:30:00.000Z" },
    });
    expect(p.newSeries).toMatchObject({ startTime: "08:30", durationMinutes: 180, allDay: false });
  });

  it("from the first visit, soft-deletes the old series instead of ending it", () => {
    const fresh = dialysis({ startsOn: FRI });
    const p = plan({
      series: fresh,
      visits: visitsOf(fresh),
      visit: idOn(fresh, FRI),
      scope: "later",
      change: { action: "edit", startTime: "07:00" },
    });
    expect(p.deleteSeries).toBe(fresh.id);
    expect(p.seriesPatch).toBeNull();
    expect(p.newSeries?.startsOn).toBe(FRI);
  });

  it("counts what's left of an 'after N' series", () => {
    // 12 visits from Mon 2 Nov: 2, 4, 6, 9, 11, 13, 16, 18 are before Fri 20, so 4 are left.
    const twelve = dialysis({ rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=12" });
    expect(ruleFrom(twelve, FRI)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=4");
    const p = plan({
      series: twelve,
      visits: visitsOf(twelve),
      visit: idOn(twelve, FRI),
      scope: "later",
      change: { action: "edit", startTime: "07:00" },
    });
    expect(p.newSeries?.rule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;COUNT=4");
    expect(ops(p, "update")).toHaveLength(4);
  });

  it("refuses this and later from a past visit, and an invalid change", () => {
    const past = planSeriesEdit({
      series,
      visits,
      visit: idOn(series, "2026-11-16"),
      scope: "later",
      change: { action: "edit", startTime: "07:00" },
      now: NOW,
      newSeriesId: NEW_ID,
    });
    expect(past).toEqual({ ok: false, problem: "A past visit can't change the visits after it" });
    const bad = planSeriesEdit({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", rule: "FREQ=WEEKLY;INTERVAL=1" },
      now: NOW,
      newSeriesId: NEW_ID,
    });
    expect(bad).toEqual({ ok: false, problem: "Choose at least one day" });
    const untitled = planSeriesEdit({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "edit", title: null },
      now: NOW,
      newSeriesId: NEW_ID,
    });
    expect(untitled).toEqual({ ok: false, problem: "Enter a title" });
  });

  it("reschedule this and later takes the new time of day for the series", () => {
    const p = plan({
      series,
      visits,
      visit: idOn(series, FRI),
      scope: "later",
      change: {
        action: "reschedule",
        occurredAt: "2026-11-20T17:00:00.000Z",
        endsAt: "2026-11-20T21:00:00.000Z",
        allDay: false,
        keepOld: true,
      },
    });
    expect(p.newSeries).toMatchObject({ startTime: "09:00", durationMinutes: 240 });
    expect(ops(p, "reschedule")).toEqual([]);
    expectNoPast(p, visits);
  });
});

describe("planSeriesEdit: this and later (cancel, delete)", () => {
  const series = dialysis();
  const visits = visitsOf(series);

  it("cancel ends the series: this visit cancelled, later touched ones cancelled, the rest deleted", () => {
    const touched = visits.map((v) => (v.seriesDay === "2026-11-25" ? { ...v, touched: true } : v));
    const p = plan({
      series,
      visits: touched,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "cancel", reason: "PT finished" },
    });
    expect(p.seriesPatch).toEqual({
      id: series.id,
      rule: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261119",
    });
    expect(p.newSeries).toBeNull();
    const cancel = { cancelledAt: NOW.toISOString(), cancelReason: "PT finished", seriesDetached: true };
    expect(writeFor(p, idOn(series, FRI))).toEqual({ op: "update", id: idOn(series, FRI), patch: cancel });
    expect(writeFor(p, idOn(series, "2026-11-25"))).toEqual({
      op: "update",
      id: idOn(series, "2026-11-25"),
      patch: cancel,
    });
    expect(writeFor(p, idOn(series, "2026-11-23"))).toEqual({ op: "delete", id: idOn(series, "2026-11-23") });
    expectNoPast(p, visits);
  });

  it("delete ends the series: this visit and later untouched ones deleted, touched ones kept", () => {
    const touched = visits.map((v) => (v.seriesDay === "2026-11-25" ? { ...v, touched: true } : v));
    const p = plan({
      series,
      visits: touched,
      visit: idOn(series, FRI),
      scope: "later",
      change: { action: "delete" },
    });
    expect(p.seriesPatch?.rule).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR;UNTIL=20261119");
    expect(writeFor(p, idOn(series, FRI))).toEqual({ op: "delete", id: idOn(series, FRI) });
    expect(writeFor(p, idOn(series, "2026-11-25"))).toEqual({
      op: "update",
      id: idOn(series, "2026-11-25"),
      patch: { seriesDetached: true },
    });
    expect(ops(p, "delete")).toHaveLength(visits.filter((v) => v.seriesDay >= FRI).length - 1);
    expectNoPast(p, visits);
  });

  it("deleting from the first visit deletes the series", () => {
    const fresh = dialysis({ startsOn: FRI });
    const p = plan({
      series: fresh,
      visits: visitsOf(fresh),
      visit: idOn(fresh, FRI),
      scope: "later",
      change: { action: "delete" },
    });
    expect(p.deleteSeries).toBe(fresh.id);
    expect(p.seriesPatch).toBeNull();
    expect(ops(p, "delete")).toHaveLength(visitsOf(fresh).length);
  });
});

describe("helpers", () => {
  it("ruleUntil replaces how a rule ends", () => {
    expect(ruleUntil("FREQ=DAILY;INTERVAL=2;COUNT=5", "2026-12-01")).toBe(
      "FREQ=DAILY;INTERVAL=2;UNTIL=20261201",
    );
  });

  it("isPastVisit: a timed visit once it starts, an all-day one at the end of its day", () => {
    expect(isPastVisit({ occurredAt: "2026-11-18T17:59:00Z", allDay: false }, LA, NOW)).toBe(true);
    expect(isPastVisit({ occurredAt: "2026-11-18T18:01:00Z", allDay: false }, LA, NOW)).toBe(false);
    expect(isPastVisit({ occurredAt: "2026-11-18T08:00:00Z", allDay: true }, LA, NOW)).toBe(false);
    expect(isPastVisit({ occurredAt: "2026-11-17T08:00:00Z", allDay: true }, LA, NOW)).toBe(true);
  });
});
