import type { AssistantAction, UnitChoices } from "@caretook/data/schema";

import { formatReading, isKnownReading } from "@caretook/data/schema";
import { dayLabel } from "./format";
import { doseText, listText, medicationTitle } from "./medicationDisplay";

// The wording of a quick-entry card: what an assistant action will save, in
// the app's own words (vitals' `formatReading`, `medicationTitle` and
// `doseText`, `dayLabel`). Pure; web:unit tests it.

export type PreviewContext = {
  units: UnitChoices;
  now: Date;
  /** The group's medications and providers by id, for their names. */
  medications: ReadonlyMap<string, { name: string; strength?: string | null }>;
  providers: ReadonlyMap<string, { name: string }>;
  locale?: string;
  /** The zone times read in (the device's, by default). */
  timeZone?: string;
};

export type ActionPreview = {
  /** The main line: "BP 130/85 mmHg, HR 72 bpm", "Pain 4", "Metformin 500 mg". */
  title: string;
  /** What else it says: a note, "Given 1 tablet", a place and providers. */
  detail: string | null;
  /** When: "Now", "7:30 AM", "Yesterday 9:00 PM", "Tuesday, Nov 24 2:00 PM", "Friday, Nov 20 · All day". */
  when: string;
};

/** Within this of now reads as "Now". */
const NOW_WINDOW_MS = 2 * 60_000;

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** When an action is dated, relative to `now`, in the viewer's zone. */
export const whenText = (
  iso: string,
  {
    now,
    locale,
    timeZone = deviceZone(),
    allDay = false,
  }: Pick<PreviewContext, "now" | "locale" | "timeZone"> & {
    allDay?: boolean;
  },
) => {
  const at = new Date(iso).getTime();
  if (!allDay && Math.abs(at - now.getTime()) <= NOW_WINDOW_MS) return "Now";
  const day = dayLabel(iso, timeZone, now, locale);
  if (allDay) return `${day} · All day`;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone }).format(at);
  return day === "Today" ? time : `${day} ${time}`;
};

const joined = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/** A card's words for one action. */
export const actionPreview = (action: AssistantAction, context: PreviewContext): ActionPreview => {
  const when = whenText(action.occurredAt, {
    ...context,
    allDay: action.type === "addEvent" && !!action.allDay,
  });
  switch (action.type) {
    case "logVital":
      return {
        title: action.readings
          .filter(isKnownReading)
          .map((r) => formatReading(r, context.units))
          .join(", "),
        detail: action.note ?? null,
        when,
      };
    case "logSymptom":
      return {
        title: action.severity != null ? `${action.name} ${action.severity}` : action.name,
        detail: action.note ?? null,
        when,
      };
    case "logDose": {
      const medication = context.medications.get(action.medicationId);
      return {
        title: medication ? medicationTitle(medication) : "Medication",
        detail: joined(doseText(action), action.note),
        when,
      };
    }
    case "addNote":
      return { title: action.title?.trim() || action.text, detail: action.title ? action.text : null, when };
    case "addEvent": {
      const names = action.providerIds.map((id) => context.providers.get(id)?.name).filter((n) => !!n);
      return {
        title: action.title,
        detail: joined(action.place, names.length ? `with ${listText(names as string[])}` : null),
        when,
      };
    }
  }
};
