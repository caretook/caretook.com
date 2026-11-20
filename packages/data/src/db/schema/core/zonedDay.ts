// Days and times of day in an IANA time zone (the care recipient's), with
// nothing but Intl: DST-safe, the same on any device. Pure; web:unit tests it.

import { addDays } from "./entryTiming";

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string) => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/** The wall clock in `timeZone` at `date`: its day, and that wall time read as if it were UTC. */
const zoneParts = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    asUtc: Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ),
  };
};

/** The calendar day ("YYYY-MM-DD") it is in `timeZone` at `now`. */
export const dayInZone = (now: Date, timeZone: string) => zoneParts(now, timeZone).day;

/** The time of day ("HH:MM", 24-hour) it is in `timeZone` at `now`. */
export const timeInZone = (now: Date, timeZone: string) => zoneParts(now, timeZone).time;

const HOUR = 3_600_000;

/** The zone's offset from UTC (ms) at the instant `at`. */
const offsetAt = (at: number, timeZone: string) => zoneParts(new Date(at), timeZone).asUtc - at;

/**
 * The moment a wall-clock time ("HH:MM") happens on a day in `timeZone`.
 * DST-safe: a time the clocks skip (2:30 on a spring-forward night) moves
 * forward by the gap (3:30); a time that happens twice (1:30 on a fall-back
 * night) is the first.
 */
export const zonedInstant = (day: string, time: string, timeZone: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0);
  // The offsets either side of any change that day; no zone changes twice in 28 hours.
  const before = wall - offsetAt(wall - 14 * HOUR, timeZone);
  const after = wall - offsetAt(wall + 14 * HOUR, timeZone);
  const fits = (t: number) => zoneParts(new Date(t), timeZone).asUtc === wall;
  const valid = [before, after].filter(fits);
  // Neither fits only in a skipped hour: `before` (the old offset) lands after the gap.
  return new Date(valid.length ? Math.min(...valid) : before);
};

/** The moment a "YYYY-MM-DD" day starts in `timeZone`. */
export const startOfDay = (day: string, timeZone: string) => zonedInstant(day, "00:00", timeZone);

/**
 * The day it is in `timeZone` at `now`, as `[from, to)` moments. A day is
 * 23 or 25 hours long when the clocks change.
 */
export const dayBounds = (now: Date, timeZone: string) => {
  const day = dayInZone(now, timeZone);
  return { day, from: startOfDay(day, timeZone), to: startOfDay(addDays(day, 1), timeZone) };
};
