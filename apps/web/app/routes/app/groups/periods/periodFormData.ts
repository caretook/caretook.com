import type { CarePeriodContentInput } from "@caretook/data/schema";
import type { NewPlace } from "../../../../lib/care-periods/carePeriods.sync";

import { dayStart, localDate } from "@caretook/data/schema";
import { parseZonedDateTime } from "@internationalized/date";

// The care period sheet's form as a period: the fields `PeriodForm` posts,
// read into the shape the device writes (`createCarePeriod`) validate. Pure,
// so web:unit tests it.

/** The form's field names (and the content fields their issues name). */
export const FIELD = {
  type: "type",
  label: "label",
  placeProviderId: "placeProviderId",
  newPlace: "newPlace",
  placeDetail: "placeDetail",
  startedAt: "startedAt",
  dateOnly: "dateOnly",
} as const;

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/**
 * The start the date field posted ("2026-11-12T14:20:00-08:00[America/Los_Angeles]")
 * as ISO 8601; a date-only start becomes the first instant of its day in the
 * recipient's zone. "" when it's missing or malformed (the schema refuses it).
 */
export const parseStart = (value: string, dateOnly: boolean, timeZone: string) => {
  let iso: string;
  try {
    iso = parseZonedDateTime(value).toAbsoluteString();
  } catch {
    return "";
  }
  return dateOnly ? new Date(dayStart(localDate(iso, timeZone), timeZone)).toISOString() : iso;
};

/** The posted form as a period's content, and a place to add by name with it. */
export const periodFromForm = (
  form: FormData,
  timeZone: string,
): { input: CarePeriodContentInput; newPlace: NewPlace } => {
  const dateOnly = form.get(FIELD.dateOnly) === "on";
  const newPlace = text(form, FIELD.newPlace);
  return {
    input: {
      type: text(form, FIELD.type) as CarePeriodContentInput["type"],
      label: text(form, FIELD.label) || null,
      placeProviderId: newPlace ? null : text(form, FIELD.placeProviderId) || null,
      placeDetail: text(form, FIELD.placeDetail) || null,
      startedAt: parseStart(text(form, FIELD.startedAt), dateOnly, timeZone),
      dateOnly,
    },
    newPlace: newPlace ? { name: newPlace } : null,
  };
};

/** Whether an issue's path is one of the form's fields (so it shows there, not as a general error). */
export const isFieldIssue = (path: string) =>
  ([FIELD.type, FIELD.label, FIELD.placeProviderId, FIELD.placeDetail, FIELD.startedAt] as string[]).includes(
    path,
  );
