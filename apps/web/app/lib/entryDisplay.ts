import type { TimelineEntryKind, UnitChoices } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";
import type { TimelineEntry } from "~/lib/rpc";

import {
  formatReading,
  isKnownReading,
  isSymptomDetails,
  isVitalDetails,
  TIMELINE_ENTRY_KINDS,
  TIMELINE_LIMITS,
} from "@caretook/data/schema";
import { Bandage, CalendarCheck, HeartPulse, NotebookPen } from "lucide-react";

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
};

export const isEntryKind = (value: string | null): value is TimelineEntryKind =>
  (TIMELINE_ENTRY_KINDS as readonly string[]).includes(value ?? "");

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

/** "Dev Caretaker" → "DC". */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
