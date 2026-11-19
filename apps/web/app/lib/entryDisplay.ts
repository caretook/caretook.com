import type { TimelineEntryKind, UnitChoices } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";
import type { TimelineEntry } from "~/lib/rpc";

import {
  formatReading,
  isKnownReading,
  isSymptomDetails,
  isVitalDetails,
  TIMELINE_LIMITS,
} from "@caretook/data/schema";
import { Bandage, CalendarCheck, ClipboardPen, HeartPulse, NotebookPen, Pill } from "lucide-react";
import { isTimelineKind } from "./timelineFilters";

// How each kind of entry looks: label, icon and color. Colors avoid green,
// which reads as "all good", and the icon carries the kind as well as the color.
export const KIND_META: Record<
  TimelineEntryKind,
  { label: string; plural: string; Icon: LucideIcon; iconClass: string }
> = {
  note: { label: "Note", plural: "Notes", Icon: NotebookPen, iconClass: "bg-base-300 text-base-content" },
  symptom: {
    label: "Symptom",
    plural: "Symptoms",
    Icon: Bandage,
    iconClass: "bg-warning text-warning-content",
  },
  event: { label: "Event", plural: "Events", Icon: CalendarCheck, iconClass: "bg-info text-info-content" },
  vital: {
    label: "Vitals",
    plural: "Vitals",
    Icon: HeartPulse,
    iconClass: "bg-secondary text-secondary-content",
  },
  // Not on the timeline yet (see `TIMELINE_KINDS`): medications slice 4 renders them.
  dose: { label: "Dose", plural: "Doses", Icon: Pill, iconClass: "bg-primary text-primary-content" },
  medicationChange: {
    label: "Medication change",
    plural: "Medication changes",
    Icon: ClipboardPen,
    iconClass: "bg-neutral text-neutral-content",
  },
};

/** A kind the timeline shows. Rows of any other kind (a newer app's, or one not rendered yet) are skipped. */
export const isEntryKind = (value: string | null): value is TimelineEntryKind => isTimelineKind(value);

/** What an entry says, ready to render: the same for rows and cards. */
export const entrySummary = (entry: TimelineEntry, units: UnitChoices) => {
  const symptom = isSymptomDetails(entry.details) ? entry.details : undefined;
  const readings = isVitalDetails(entry.details)
    ? entry.details.readings.filter(isKnownReading).map((r) => formatReading(r, units))
    : [];
  return {
    heading: (entry.kind === "symptom" ? symptom?.name : entry.title) || null,
    severity: symptom?.severity != null ? `${symptom.severity}/${TIMELINE_LIMITS.severityMax}` : null,
    readings,
    body: entry.body || null,
  };
};

/** "Dev Caretaker" → "DC" (shared with `UserAvatar`; see `lib/initials.ts`). */
export { initials } from "./initials";
