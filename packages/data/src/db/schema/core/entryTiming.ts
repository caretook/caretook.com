// When an entry may be dated, and calendar days in an entry's own zone.
// Client-safe and pure: the content schema, the service, the device's writes
// and the web's time rules (`lib/appointments/upcoming`) all use it.

/**
 * The kinds that may be dated in the future: a future event is an
 * appointment, a future note a reminder. Symptoms and vitals are felt or
 * measured, and a dose is given (or skipped) when it happens, so none of
 * them can be ahead of now; neither can a medication change.
 */
export const FUTURE_KINDS = ["note", "event"] as const;
export type FutureKind = (typeof FUTURE_KINDS)[number];

export const isFutureKind = (kind: string | null | undefined): kind is FutureKind =>
  (FUTURE_KINDS as readonly string[]).includes(kind ?? "");

/** How far ahead of the device's clock a non-future entry may be: a vital logged "just now". */
export const DEVICE_FUTURE_SKEW_MS = 5 * 60_000;

/**
 * How far ahead of the server's clock. Wider than the device's: a refused
 * upload is acknowledged as rejected and the server's copy restored, so a
 * device whose clock runs fast must not lose a real vital.
 */
export const SERVER_FUTURE_SKEW_MS = 60 * 60_000;

/** The field issue on `occurredAt` when the rule refuses an entry. */
export const FUTURE_DATE_MESSAGE = "Can't be in the future";

/**
 * True when an entry of this kind can't be dated `occurredAt`: it isn't a
 * future kind, and it's more than `skewMs` after `now`. Exactly `now + skewMs`
 * is allowed. An unparseable time is left to the schema to refuse.
 */
export const isTooFarAhead = (kind: string, occurredAt: string, now: Date, skewMs: number) => {
  if (isFutureKind(kind)) return false;
  const at = new Date(occurredAt).getTime();
  return Number.isFinite(at) && at > now.getTime() + skewMs;
};

// ---------------------------------------------------------------------------
// Calendar days in a zone (all-day entries)
// ---------------------------------------------------------------------------

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const dateFormat = (timeZone: string) => {
  let format = dateFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormats.set(timeZone, format);
  }
  return format;
};

/** The calendar date an instant falls on in a zone, as "YYYY-MM-DD". */
export const localDate = (instant: string | number | Date, timeZone: string) => {
  const parts = dateFormat(timeZone).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

/**
 * True when `iso` is the first instant of its calendar day in `timeZone`
 * (where an all-day entry starts). Usually local midnight; on a day whose
 * midnight is skipped by a DST change, whenever that day begins.
 */
export const isStartOfDay = (iso: string, timeZone: string) => {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return false;
  return localDate(at, timeZone) !== localDate(at - 1, timeZone);
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * The first instant of the calendar day `date` ("YYYY-MM-DD") in `timeZone`,
 * as epoch milliseconds. Zone offsets are whole minutes within ±15 hours, so
 * this searches that span by the minute: exact across DST changes, including
 * zones whose midnight is skipped.
 */
export const dayStart = (date: string, timeZone: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const utcMidnight = Date.UTC(y!, m! - 1, d);
  // The earliest minute whose local date is `date` or later.
  let lo = (utcMidnight - 15 * HOUR_MS) / MINUTE_MS;
  let hi = (utcMidnight + 15 * HOUR_MS) / MINUTE_MS;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(mid * MINUTE_MS, timeZone) >= date) hi = mid;
    else lo = mid + 1;
  }
  return lo * MINUTE_MS;
};

/** "YYYY-MM-DD" plus `days` calendar days. */
export const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

/**
 * The end of the calendar day `instant` falls on in `timeZone`: the first
 * instant of the next day, as epoch milliseconds. An all-day entry is
 * upcoming until then. Days can be 23 or 25 hours long.
 */
export const endOfDay = (instant: string | number | Date, timeZone: string) =>
  dayStart(addDays(localDate(instant, timeZone), 1), timeZone);
