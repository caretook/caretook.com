import { localDate } from "../core/entryTiming";

// A care group's track of care periods, worked out from the stored rows.
// Client-safe and pure: the device, the screens, the service and (later)
// search all read the track through here.
//
// The rules:
// - Periods are stored by start only. A period ends where the next one
//   starts; the latest has no end and is current. Care never ends.
// - Order is (started_at, created_at, id). Two periods with the same start
//   both stay: the earlier-created one has zero length, and still shows (so
//   it can be deleted).
// - Deleted periods aren't on the track, so deleting one extends the one
//   before it.

/** What the track needs from a period (a device row or a server row, mapped). */
export type TrackPeriod = {
  id: string;
  /** ISO 8601. */
  startedAt: string;
  /** ISO 8601: breaks ties between equal starts. */
  createdAt: string;
  deletedAt: string | null;
};

/** A period on the track, with its derived end (null for the current one). */
export type PeriodSpan<P extends TrackPeriod = TrackPeriod> = {
  period: P;
  /** ISO 8601. */
  startsAt: string;
  /** ISO 8601, or null: the current period runs until now. */
  endsAt: string | null;
};

const ms = (iso: string) => {
  const at = new Date(iso).getTime();
  return Number.isFinite(at) ? at : 0;
};

const iso = (value: string) => new Date(ms(value)).toISOString();

/** The track's order: start, then when it was created, then id. */
export const comparePeriods = (a: TrackPeriod, b: TrackPeriod) =>
  ms(a.startedAt) - ms(b.startedAt) ||
  ms(a.createdAt) - ms(b.createdAt) ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** The track: live periods in order, oldest first, each ending where the next starts. */
export const periodSpans = <P extends TrackPeriod>(periods: readonly P[]): PeriodSpan<P>[] => {
  const live = periods.filter((p) => !p.deletedAt).sort(comparePeriods);
  return live.map((period, i) => {
    const next = live[i + 1];
    return { period, startsAt: iso(period.startedAt), endsAt: next ? iso(next.startedAt) : null };
  });
};

/**
 * The period care was in at `instant`: the span whose start is at or before
 * it (inclusive) and whose end is after it. Null before the first period. A
 * zero-length span (a tie) contains no instant: the later one wins.
 */
export const periodAt = <P extends TrackPeriod>(
  spans: readonly PeriodSpan<P>[],
  instant: string | number | Date,
): PeriodSpan<P> | null => {
  const at = new Date(instant).getTime();
  for (let i = spans.length - 1; i >= 0; i--) {
    const span = spans[i]!;
    if (ms(span.startsAt) <= at && (span.endsAt === null || at < ms(span.endsAt))) return span;
  }
  return null;
};

/** Calendar days from day `a` to day `b` ("YYYY-MM-DD"), negative when `b` is earlier. */
const daysBetween = (a: string, b: string) => {
  const day = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return Date.UTC(y!, m! - 1, dd);
  };
  return Math.round((day(b) - day(a)) / 86_400_000);
};

/**
 * "Day N" of a period at `now`: calendar days in the recipient's zone, the
 * start's day being day 1 (at least 1, whatever the clocks say).
 */
export const periodDay = (startsAt: string, now: string | number | Date, timeZone: string) =>
  Math.max(1, daysBetween(localDate(startsAt, timeZone), localDate(now, timeZone)) + 1);

/**
 * "Day N" of a period on a calendar day ("YYYY-MM-DD", a timeline day header's
 * key, in the viewer's zone): from the start's date in the recipient's zone to
 * that day, the start's day being day 1 (at least 1). Counting from the
 * header's own date keeps consecutive headers one apart when the viewer and
 * recipient are in different zones; `periodDay` can give two of them one number.
 */
export const periodDayOn = (startsAt: string, dayKey: string, timeZone: string) =>
  Math.max(1, daysBetween(localDate(startsAt, timeZone), dayKey) + 1);

/**
 * The current period (the latest on the track: future starts are refused,
 * so it's the one care is in now) and its day count, or null with no periods.
 */
export const currentPeriod = <P extends TrackPeriod>(
  spans: readonly PeriodSpan<P>[],
  now: string | number | Date,
  timeZone: string,
): { span: PeriodSpan<P>; day: number } | null => {
  const span = spans[spans.length - 1];
  return span ? { span, day: periodDay(span.startsAt, now, timeZone) } : null;
};

/**
 * How long a period lasted (or has lasted, up to `now`), in calendar days in
 * the recipient's zone: 0 when it ended the day it started.
 */
export const periodLengthDays = (span: PeriodSpan, now: string | number | Date, timeZone: string) =>
  Math.max(
    0,
    daysBetween(localDate(span.startsAt, timeZone), localDate(span.endsAt ?? new Date(now), timeZone)),
  );

/** A period's time range (for search): its start, and its end or null while it's current. Null when it isn't on the track. */
export const periodRange = (spans: readonly PeriodSpan[], periodId: string) => {
  const span = spans.find((s) => s.period.id === periodId);
  return span ? { from: span.startsAt, to: span.endsAt } : null;
};

/** The period before and after one on the track (for stepping through the history). */
export const neighbours = <P extends TrackPeriod>(spans: readonly PeriodSpan<P>[], periodId: string) => {
  const i = spans.findIndex((s) => s.period.id === periodId);
  if (i < 0) return { previous: null, next: null };
  return { previous: spans[i - 1] ?? null, next: spans[i + 1] ?? null };
};
