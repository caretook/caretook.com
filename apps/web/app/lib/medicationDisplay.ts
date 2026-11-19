import type {
  DoseDetails,
  MedicationChangeDetails,
  MedicationForm,
  MedicationSchedule,
  MedicationStatus,
  MedicationStopReason,
  MedicationSummary,
  MedicationTrackedField,
} from "@caretook/data/schema";
import type { DoseSlot, DoseWarning } from "./dueDoses";

import { timeInZone } from "./zonedDay";

// How medications, their schedules, doses and changes read on screen: the
// list, the medication page and its history (and later the timeline's rows,
// Today and the printout). Pure: no React or database here; web:unit tests it.

export const FORM_LABELS: Record<MedicationForm, string> = {
  tablet: "Tablet",
  capsule: "Capsule",
  liquid: "Liquid",
  injection: "Injection",
  patch: "Patch",
  inhaler: "Inhaler",
  drops: "Drops",
  cream: "Cream",
  other: "Other",
};

export const STATUS_LABELS: Record<MedicationStatus, string> = {
  current: "Current",
  completed: "Completed",
  discontinued: "Discontinued",
};

export const STOP_REASON_LABELS: Record<MedicationStopReason, string> = {
  sideEffects: "Side effects",
  ineffective: "Not working",
  prescriberStopped: "Prescriber stopped it",
  other: "Other reason",
};

const FIELD_LABELS: Record<MedicationTrackedField, string> = {
  name: "name",
  strength: "strength",
  form: "form",
  dose: "dose",
  directions: "directions",
  schedule: "schedule",
};

/** A schedule time ("08:00") as it reads: "8:00", "20:00". */
export const clockTime = (time: string) => time.replace(/^0(\d:)/, "$1");

/** "a", "a and b", "a, b and c". */
export const listText = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/** "8:00 and 20:00", "As needed, up to 4 a day", "As needed". */
export const scheduleText = (schedule: MedicationSchedule) => {
  if (schedule.type === "scheduled") return listText(schedule.times.map(clockTime));
  return schedule.maxPerDay ? `As needed, up to ${schedule.maxPerDay} a day` : "As needed";
};

/** The name with its strength: "Lisinopril 10 mg". */
export const medicationTitle = ({ name, strength }: { name: string; strength?: string | null }) =>
  strength?.trim() ? `${name} ${strength.trim()}` : name;

/** A medication's form, dose and schedule, for a list row: "Tablet · 1 tablet · 8:00 and 20:00". */
export const medicationSummaryLine = ({
  form,
  dose,
  schedule,
}: {
  form: MedicationForm | null;
  dose: string | null;
  schedule: MedicationSchedule;
}) =>
  [form ? FORM_LABELS[form] : null, dose?.trim() || null, scheduleText(schedule)].filter(Boolean).join(" · ");

/** A calendar day ("2026-11-10") as it reads: "Nov 10, 2026". Days have no zone, so none shifts it. */
export const formatDate = (day: string, locale?: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

/**
 * Why and when a medication stopped, or null for a current one:
 * "Completed Nov 10, 2026", "Discontinued Nov 2, 2026 · Side effects".
 */
export const stoppedText = (
  {
    status,
    stoppedOn,
    stopReason,
  }: { status: MedicationStatus; stoppedOn: string | null; stopReason: MedicationStopReason | null },
  locale?: string,
) => {
  if (status === "current") return null;
  const when = stoppedOn ? ` ${formatDate(stoppedOn, locale)}` : "";
  const why = status === "discontinued" && stopReason ? ` · ${STOP_REASON_LABELS[stopReason]}` : "";
  return `${STATUS_LABELS[status]}${when}${why}`;
};

// ---------------------------------------------------------------------------
// Doses and changes
// ---------------------------------------------------------------------------

const DOSE_STATUS_LABELS: Record<DoseDetails["status"], string> = {
  given: "Given",
  skipped: "Skipped",
  refused: "Refused",
};

/** What a dose entry says: "Given 1 tablet", "Skipped", "Refused". */
export const doseText = ({ status, amount }: Pick<DoseDetails, "status" | "amount">) =>
  status === "given" && amount?.trim() ? `Given ${amount.trim()}` : DOSE_STATUS_LABELS[status];

/** The slot a dose answers, when it answers one: "8:00 dose". */
export const doseSlotText = ({ scheduledFor }: Pick<DoseDetails, "scheduledFor">) =>
  scheduledFor ? `${clockTime(scheduledFor)} dose` : null;

/** One tracked field's value in a change: the schedule and form as they read, an empty one as "none". */
const fieldValue = (field: MedicationTrackedField, summary: MedicationSummary | undefined) => {
  const value = summary?.[field];
  if (value === null || value === undefined || value === "") return "none";
  if (field === "schedule") return scheduleText(value as MedicationSchedule);
  if (field === "form") return FORM_LABELS[value as MedicationForm].toLowerCase();
  return value as string;
};

/** "dose 10 mg → 20 mg, schedule 8:00 → 8:00 and 20:00". */
const editsText = (details: MedicationChangeDetails) =>
  (details.fields ?? [])
    .map(
      (field) =>
        `${FIELD_LABELS[field]} ${fieldValue(field, details.before)} → ${fieldValue(field, details.after)}`,
    )
    .join(", ");

/**
 * What a change entry says: "Started", "Changed dose 1 tablet → 2 tablets",
 * "Discontinued: side effects", "Completed", "Resumed". A stop or restart
 * saved with field edits adds them ("Resumed; changed dose …").
 */
export const changeText = (details: MedicationChangeDetails) => {
  const edits = editsText(details);
  switch (details.change) {
    case "started":
      return "Started";
    case "changed":
      return edits ? `Changed ${edits}` : "Changed";
    case "resumed":
      return edits ? `Resumed; changed ${edits}` : "Resumed";
    case "stopped": {
      const status = details.stopStatus ?? "discontinued";
      const reason =
        status === "discontinued" && details.stopReason
          ? `: ${STOP_REASON_LABELS[details.stopReason].toLowerCase()}`
          : "";
      const stop = `${STATUS_LABELS[status]}${reason}`;
      return edits ? `${stop}; changed ${edits}` : stop;
    }
  }
};

/**
 * Schedule times are the recipient's: say so when the viewer's device is in
 * another zone ("Times are New York time"), else null.
 */
export const scheduleZoneNote = (recipientZone: string | null, deviceZone: string) => {
  if (!recipientZone || recipientZone === deviceZone) return null;
  const place = recipientZone.split("/").at(-1)?.replaceAll("_", " ") ?? recipientZone;
  return `Times are ${place} time`;
};

// ---------------------------------------------------------------------------
// Today and Due now
// ---------------------------------------------------------------------------

/** A moment as the recipient's clock reads it: "8:05", "20:00". */
export const clockAt = (iso: string, timeZone: string) => clockTime(timeInZone(new Date(iso), timeZone));

/** A slot's state as it reads: "Due", "Overdue", "Later", "Given 8:05", "Skipped", "Refused", "Missed". */
export const slotStateText = (slot: Pick<DoseSlot, "state" | "dose">, timeZone: string) => {
  switch (slot.state) {
    case "upcoming":
      return "Later";
    case "due":
      return "Due";
    case "overdue":
      return "Overdue";
    case "missed":
      return "Missed";
    case "given":
      return slot.dose ? `Given ${clockAt(slot.dose.occurredAt, timeZone)}` : "Given";
    case "skipped":
      return "Skipped";
    case "refused":
      return "Refused";
  }
};

/** An as-needed medication's day so far: "2 of 4 today", "1 today", "None today". */
export const asNeededCountText = ({ count, max }: { count: number; max: number | null }) => {
  if (max !== null) return `${count} of ${max} today`;
  return count ? `${count} today` : "None today";
};

/** Yesterday's missed slots on one line: "Missed yesterday: Metformin 500 mg at 20:00 and …", or null. */
export const missedText = (
  slots: readonly (Pick<DoseSlot, "time"> & { medication: { name: string; strength?: string | null } })[],
) =>
  slots.length
    ? `Missed yesterday: ${listText(slots.map((s) => `${medicationTitle(s.medication)} at ${clockTime(s.time)}`))}`
    : null;

/** Why a dose about to be logged may be a mistake, in words. */
export const doseWarningText = (warning: DoseWarning, timeZone: string) =>
  warning.type === "alreadyGiven"
    ? `The ${clockTime(warning.time)} dose was already given at ${clockAt(warning.givenAt, timeZone)}.`
    : `${warning.count} of ${warning.max} already given today, the most a day.`;

/** A due slot as a Due now item or Dose sheet choice: "Metformin 500 mg · 20:00 dose, overdue". */
export const dueSlotLabel = (
  slot: Pick<DoseSlot, "time" | "state"> & { medication: { name: string; strength?: string | null } },
) =>
  `${medicationTitle(slot.medication)} · ${clockTime(slot.time)} dose${slot.state === "overdue" ? ", overdue" : ""}`;
