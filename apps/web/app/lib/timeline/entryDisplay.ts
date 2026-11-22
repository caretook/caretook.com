import type { TimelineEntryKind, UnitChoices } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";
import type { AccentOrNeutral } from "~/components/ui/accents";
import type { IconChipLook } from "~/components/ui/IconChip";
import type { TimelineEntry } from "~/lib/core/rpc";

import {
  formatReading,
  isKnownReading,
  isSymptomDetails,
  isVitalDetails,
  TIMELINE_LIMITS,
} from "@caretook/data/schema";
import {
  Bandage,
  CalendarCheck,
  ClipboardPlus,
  HeartPulse,
  NotebookPen,
  Pill,
  PillBottle,
} from "lucide-react";
import { isTimelineKind } from "./timelineFilters";

// How each kind of entry looks: label, icon, and an accent in a look. Accents
// are never status colours, so a kind doesn't read as urgent, and the icon and
// label carry the kind as well as the colour.
export type KindChip = { accent: AccentOrNeutral; look: IconChipLook };

export const KIND_META: Record<
  TimelineEntryKind,
  { label: string; plural: string; Icon: LucideIcon } & KindChip
> = {
  note: { label: "Note", plural: "Notes", Icon: NotebookPen, accent: "neutral", look: "solid" },
  symptom: { label: "Symptom", plural: "Symptoms", Icon: Bandage, accent: "pink", look: "solid" },
  // The Planner's colour.
  event: { label: "Event", plural: "Events", Icon: CalendarCheck, accent: "orange", look: "solid" },
  vital: { label: "Vitals", plural: "Vitals", Icon: HeartPulse, accent: "plum", look: "solid" },
  // Medications' colour: solid for a dose, soft for a change to the list.
  dose: { label: "Dose", plural: "Doses", Icon: Pill, accent: "teal", look: "solid" },
  medicationChange: {
    label: "Medication change",
    plural: "Medication changes",
    Icon: PillBottle,
    accent: "teal",
    look: "soft",
  },
  // A condition added, changed, resolved or reactivated (conditions PRD).
  conditionChange: {
    label: "Condition change",
    plural: "Condition changes",
    Icon: ClipboardPlus,
    accent: "indigo",
    look: "soft",
  },
};

/** Quick entry's to-do card: a todo isn't a timeline entry, so it has no `KIND_META`. */
export const TODO_CHIP: KindChip = { accent: "orange", look: "soft" };

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

/** "Dev Caretaker" → "DC" (shared with `UserAvatar`; see `lib/core/initials.ts`). */
export { initials } from "../core/initials";
