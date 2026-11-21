import type { UnitChoices } from "../timeline/vitals";
import type { AssistantAction } from "./assistantActions";

import { dayLabel } from "../core/dayLabel";
import { doseText, listText, medicationCountText, medicationTitle } from "../medications/medicationDisplay";
import { dueText } from "../todos/todoDisplay";
import { formatReading, isKnownReading } from "../timeline/vitals";

// The wording of a quick-entry card: what an assistant action will save, in
// the app's own words (vitals' `formatReading`, `medicationTitle` and
// `doseText`, `dayLabel`). Pure; web:unit tests it.

export type PreviewContext = {
  units: UnitChoices;
  now: Date;
  /** The group's medications and providers by id, for their names. */
  medications: ReadonlyMap<string, { name: string; strength?: string | null }>;
  providers: ReadonlyMap<string, { name: string }>;
  /** The group's passes by id, with how many medications are still open in each today. */
  passes?: ReadonlyMap<string, { name: string; open?: number }>;
  locale?: string;
  /** The zone times read in (the device's, by default). */
  timeZone?: string;
  /** The group's members by id, for a todo's assignee. */
  members?: ReadonlyMap<string, { name: string }>;
  /** The recipient's zone, which a todo's due day is in (else `timeZone`). */
  recipientTimeZone?: string;
};

export type ActionPreview = {
  /** The main line: "BP 130/85 mmHg, HR 72 bpm", "Pain 4", "Metformin 500 mg". */
  title: string;
  /** What else it says: a note, "Given 1 tablet", a place and providers. */
  detail: string | null;
  /** When: "Now", "7:30 AM", "Yesterday 9:00 PM", "Tuesday, Nov 24 2:00 PM", "Friday, Nov 20 · All day"; a todo's due ("Due Fri"). */
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

/** "with Dr. Lee and Riverside Dialysis": the providers a note or event names, by their names. */
const withText = (ids: readonly string[], context: PreviewContext) => {
  const names = ids.map((id) => context.providers.get(id)?.name).filter((n): n is string => !!n);
  return names.length ? `with ${listText(names)}` : null;
};

/** A card's words for one action. */
export const actionPreview = (action: AssistantAction, context: PreviewContext): ActionPreview => {
  if (action.type === "addTodo") {
    // "Todo · Due Fri", "Call pharmacy", "Sam Rivera".
    const zone = context.recipientTimeZone ?? context.timeZone ?? deviceZone();
    const due = { dueOn: action.dueOn ?? null, dueTime: action.dueTime ?? null, doneAt: null };
    return {
      title: action.title,
      detail: (action.assigneeId && context.members?.get(action.assigneeId)?.name) || null,
      when: dueText(due, context.now, zone) ?? "No due date",
    };
  }
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
    case "givePass": {
      const pass = context.passes?.get(action.passId);
      return {
        title: pass ? `${pass.name} medications` : "Medications",
        detail: joined("Given all", pass?.open ? medicationCountText(pass.open) : null),
        when,
      };
    }
    case "addNote":
      return {
        title: action.title?.trim() || action.text,
        detail: joined(action.title ? action.text : null, withText(action.providerIds, context)),
        when,
      };
    case "addEvent":
      return {
        title: action.title,
        detail: joined(action.place, withText(action.providerIds, context)),
        when,
      };
  }
};
