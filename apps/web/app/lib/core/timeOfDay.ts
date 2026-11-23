// Wall-clock "HH:MM" helpers for the time pickers (`TimeSelect`, `DateTimeField`'s
// minute steps). Pure, so web:unit tests them.

/** The minutes a picker offers. */
export const QUARTER_MINUTES = ["00", "15", "30", "45"] as const;

/** The hour it is now in `timeZone`, 0 to 23. */
export const currentHourIn = (timeZone: string, now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone });
  return Number(parts.formatToParts(now).find((part) => part.type === "hour")?.value ?? 0);
};

/** A new time's default: this hour in `timeZone`, on the hour, as "HH:00". */
export const currentHourTime = (timeZone: string, now = new Date()) =>
  `${String(currentHourIn(timeZone, now)).padStart(2, "0")}:00`;

/** The minute options for a saved minute: the quarters, plus it in order when it's off them. */
export const minuteOptions = (minute: string): string[] =>
  !minute || (QUARTER_MINUTES as readonly string[]).includes(minute)
    ? [...QUARTER_MINUTES]
    : [...QUARTER_MINUTES, minute].sort();

/** The next minute on a `step` grid, up or down, wrapping within the hour (:10 goes to :15 or :00). */
export const steppedMinute = (minute: number, sign: 1 | -1, step: number) => {
  const next = sign > 0 ? (Math.floor(minute / step) + 1) * step : (Math.ceil(minute / step) - 1) * step;
  return (next + 60) % 60;
};
