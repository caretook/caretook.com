import type {
  TimelineEntryKind,
  TimelineEntryUpdateInput,
  UnitChoices,
  VitalReading,
  VitalType,
} from "@caretook/data/schema";

import { fromDisplay, VITAL_TYPES, VITALS } from "@caretook/data/schema";
import { parseZonedDateTime } from "@internationalized/date";
import { formString } from "./form";
import { localTimeZone } from "./format";

/** DateTimeField's submitted value as ISO 8601 (UTC), or "" if it's missing or malformed. */
const parseOccurredAt = (value: string) => {
  try {
    return parseZonedDateTime(value).toAbsoluteString();
  } catch {
    return "";
  }
};

const optional = (value: string) => value.trim() || null;

/** The name of one vital reading's input: `vital.0.type`, `vital.0.systolic`… */
export const vitalInputName = (index: number, key: string) => `vital.${index}.${key}`;

/**
 * The readings a vitals form submitted, converted from the user's units to
 * the stored ones. A blank number is `null`: fine for optional fields, and
 * the server explains it for required ones.
 */
const readingsFromForm = (form: FormData, units: UnitChoices): VitalReading[] => {
  const readings: VitalReading[] = [];
  for (let i = 0; form.has(vitalInputName(i, "type")); i++) {
    const type = formString(form, vitalInputName(i, "type")) as VitalType;
    if (!VITAL_TYPES.includes(type)) continue;
    const reading: Record<string, unknown> = { type };
    for (const field of VITALS[type].fields) {
      const raw = formString(form, vitalInputName(i, field.key)).trim();
      const value = raw === "" ? null : Number(raw);
      reading[field.key] = value === null || Number.isNaN(value) ? null : fromDisplay(field, value, units);
    }
    // Shaped by VITALS; the server validates the real shape.
    readings.push(reading as VitalReading);
  }
  return readings;
};

/**
 * The entry fields an EntryForm submits. The server validates them again
 * (per kind); this only shapes the form into the API's input. `units` are
 * the ones the form showed, so vitals convert back correctly.
 */
export const entryContentFromForm = (form: FormData, units: UnitChoices) => {
  const kind = formString(form, "kind") as TimelineEntryKind;
  const severity = formString(form, "severity");
  const shared = {
    occurredAt: parseOccurredAt(formString(form, "occurredAt")),
    timeZone: localTimeZone(),
    title: optional(formString(form, "title")),
    body: optional(formString(form, "body")),
  };

  switch (kind) {
    case "symptom":
      return {
        kind,
        ...shared,
        details: {
          name: formString(form, "symptomName"),
          severity: severity === "" ? null : Number(severity),
        },
      };
    case "vital":
      return { kind, ...shared, details: { readings: readingsFromForm(form, units) } };
    // Notes aren't made in a form (their text is their live document), so
    // anything else is an event; a wrong kind still fails validation.
    default:
      return { kind: "event" as const, ...shared, title: formString(form, "title"), details: null };
  }
};

/** The same, as an update: content only (kind, group and recipient never change). */
export const entryUpdateFromForm = (form: FormData, units: UnitChoices): TimelineEntryUpdateInput => {
  const { kind: _kind, ...content } = entryContentFromForm(form, units);
  return content;
};
