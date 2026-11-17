import type { TimelineEntryKind, TimelineEntryUpdateInput } from "@caretook/data/schema";

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

/**
 * The entry fields an EntryForm submits. The server validates them again
 * (per kind); this only shapes the form into the API's input.
 */
export const entryContentFromForm = (form: FormData) => {
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
    case "event":
      return { kind, ...shared, title: formString(form, "title"), details: null };
    default:
      return { kind: "note" as const, ...shared, body: formString(form, "body"), details: null };
  }
};

/** The same, as an update: content only (kind, group and recipient never change). */
export const entryUpdateFromForm = (form: FormData): TimelineEntryUpdateInput => {
  const { kind: _kind, ...content } = entryContentFromForm(form);
  return content;
};
