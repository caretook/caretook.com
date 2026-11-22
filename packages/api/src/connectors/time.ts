// Times in connector answers are ISO 8601 with the care recipient's offset
// ("2026-11-20T20:05:00-08:00"), so "8 pm" means the same in the chat as in
// the app. The zone's name is in group_overview.

const formats = new Map<string, Intl.DateTimeFormat>();

const formatFor = (timeZone: string) => {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "longOffset",
    });
    formats.set(timeZone, format);
  }
  return format;
};

/** `instant` as ISO 8601 in `timeZone`, with its offset (seconds, no milliseconds). */
export const zonedIso = (instant: string | number | Date, timeZone: string) => {
  const parts = formatFor(timeZone).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  // "GMT-08:00", or "GMT" at UTC.
  const offset = part("timeZoneName").replace("GMT", "") || "+00:00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}${offset}`;
};

/** `zonedIso`, keeping null as null. */
export const zonedIsoOrNull = (instant: string | null | undefined, timeZone: string) =>
  instant ? zonedIso(instant, timeZone) : null;
