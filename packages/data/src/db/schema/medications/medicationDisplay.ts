import type {
  DoseDetails,
  MedicationChangeDetails,
  MedicationForm,
  MedicationSchedule,
  MedicationStatus,
  MedicationStopReason,
  MedicationSummary,
  MedicationTrackedField,
  PassMovedDetails,
  ScheduleSlot,
} from "./medication";
import type { PassLike } from "./medicationPass";
import type { DoseSlot, DoseWarning } from "./dueDoses";

import { timeInZone } from "../core/zonedDay";
import { isPassSlot, slotKey } from "./medication";
import { sortPasses } from "./medicationPass";

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

/** What schedule wording needs of a pass (deleted ones too, so old schedules keep their names). */
export type SchedulePass = Pick<PassLike, "id" | "name" | "time" | "sortOrder">;

/** A slot's amount as the schedule shows it: only when it's set and differs from the usual dose. */
const shownAmount = (slot: ScheduleSlot, dose: string | null | undefined) => {
  const amount = slot.amount?.trim();
  return amount && amount !== dose?.trim() ? amount : null;
};

/**
 * A scheduled medication's slots as they read, in the day's order: passes
 * first (in the passes' order), then times of their own by time. A slot in a
 * pass this device doesn't know is left out.
 */
const slotLabels = (
  slots: readonly ScheduleSlot[],
  passes: readonly SchedulePass[],
  dose?: string | null,
): string[] => {
  const known = new Map(passes.map((p) => [p.id, p]));
  const inPasses = sortPasses(
    slots.flatMap((slot) => {
      const pass = isPassSlot(slot) ? known.get(slot.passId) : undefined;
      return pass ? [{ ...pass, slot }] : [];
    }),
  );
  const own = slots
    .flatMap((slot) => (isPassSlot(slot) ? [] : [slot]))
    .sort((a, b) => a.time.localeCompare(b.time));
  const label = (name: string, slot: ScheduleSlot) => {
    const amount = shownAmount(slot, dose);
    return amount ? `${name} (${amount})` : name;
  };
  return [
    ...inPasses.map((p) => label(p.name, p.slot)),
    ...own.map((slot) => label(clockTime(slot.time), slot)),
  ];
};

/**
 * "Morning and Evening", "Morning (1000 mg), Evening (500 mg) and 14:00",
 * "8:00 and 20:00", "As needed, up to 4 a day", "As needed". Passes read by
 * name, in their order, then times of their own; a slot's amount shows when
 * it differs from `dose` (the medication's usual dose).
 */
export const scheduleText = (
  schedule: MedicationSchedule,
  passes: readonly SchedulePass[] = [],
  dose?: string | null,
) => {
  if (schedule.type === "scheduled") return listText(slotLabels(schedule.slots, passes, dose)) || "Every day";
  return schedule.maxPerDay ? `As needed, up to ${schedule.maxPerDay} a day` : "As needed";
};

/** The name with its strength: "Lisinopril 10 mg". */
export const medicationTitle = ({ name, strength }: { name: string; strength?: string | null }) =>
  strength?.trim() ? `${name} ${strength.trim()}` : name;

/** A medication's form, dose and schedule, for a list row: "Tablet · 1 tablet · 8:00 and 20:00". */
export const medicationSummaryLine = (
  {
    form,
    dose,
    schedule,
  }: {
    form: MedicationForm | null;
    dose: string | null;
    schedule: MedicationSchedule;
  },
  passes: readonly SchedulePass[] = [],
) =>
  [form ? FORM_LABELS[form] : null, dose?.trim() || null, scheduleText(schedule, passes, dose)]
    .filter(Boolean)
    .join(" · ");

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
const fieldValue = (
  field: MedicationTrackedField,
  summary: MedicationSummary | undefined,
  passes: readonly SchedulePass[],
) => {
  const value = summary?.[field];
  if (value === null || value === undefined || value === "") return "none";
  if (field === "schedule") return scheduleText(value as MedicationSchedule, passes);
  if (field === "form") return FORM_LABELS[value as MedicationForm].toLowerCase();
  return value as string;
};

/**
 * What a schedule edit did, slot by slot, when it stayed at set times:
 * "added to Evening", "removed from Morning", "added 14:00", "removed 21:00",
 * "Morning amount 500 mg → 1000 mg". Null when the edit isn't that kind (a
 * switch to or from as needed, or a new maximum), which reads as the whole
 * schedule before and after.
 */
export const scheduleChangeParts = (
  before: MedicationSchedule | undefined,
  after: MedicationSchedule | undefined,
  passes: readonly SchedulePass[] = [],
): string[] | null => {
  if (before?.type !== "scheduled" || after?.type !== "scheduled") return null;
  const byKey = (slots: readonly ScheduleSlot[]) => new Map(slots.map((slot) => [slotKey(slot), slot]));
  const was = byKey(before.slots);
  const now = byKey(after.slots);
  const passOf = new Map(passes.map((p) => [p.id, p]));
  const name = (slot: ScheduleSlot) =>
    isPassSlot(slot) ? (passOf.get(slot.passId)?.name ?? "a pass") : clockTime(slot.time);
  // Passes in their order (unknown ones last), then times by time.
  const passRank = new Map(sortPasses(passes).map((p, index) => [p.id, index]));
  const rank = (slot: ScheduleSlot) =>
    isPassSlot(slot)
      ? `0 ${String(passRank.get(slot.passId) ?? passes.length).padStart(3, "0")} ${slot.passId}`
      : `1 ${slot.time}`;
  const order = (slots: ScheduleSlot[]) => [...slots].sort((a, b) => rank(a).localeCompare(rank(b)));
  const withAmount = (slot: ScheduleSlot) => (slot.amount ? `${name(slot)} (${slot.amount})` : name(slot));
  const added = order(after.slots.filter((slot) => !was.has(slotKey(slot))));
  const removed = order(before.slots.filter((slot) => !now.has(slotKey(slot))));
  const amounts = order(
    after.slots.filter((slot) => {
      const old = was.get(slotKey(slot));
      return old && (old.amount ?? null) !== (slot.amount ?? null);
    }),
  );

  const parts: string[] = [];
  const addedPasses = added.filter(isPassSlot);
  const addedTimes = added.filter((slot) => !isPassSlot(slot));
  const removedPasses = removed.filter(isPassSlot);
  const removedTimes = removed.filter((slot) => !isPassSlot(slot));
  if (addedPasses.length) parts.push(`added to ${listText(addedPasses.map(withAmount))}`);
  if (addedTimes.length) parts.push(`added ${listText(addedTimes.map(withAmount))}`);
  if (removedPasses.length) parts.push(`removed from ${listText(removedPasses.map(name))}`);
  if (removedTimes.length) parts.push(`removed ${listText(removedTimes.map(name))}`);
  for (const slot of amounts) {
    const old = was.get(slotKey(slot))?.amount ?? "usual dose";
    parts.push(`${name(slot)} amount ${old} → ${slot.amount ?? "usual dose"}`);
  }
  return parts;
};

/**
 * The edits a change made, as phrases after "Changed" ("dose 10 mg → 20 mg,
 * form tablet → capsule"), and a schedule edit's own phrases ("added to
 * Evening"), kept apart so each reads on its own.
 */
const editsText = (details: MedicationChangeDetails, passes: readonly SchedulePass[]) => {
  const fields: string[] = [];
  let schedule: string[] = [];
  for (const field of details.fields ?? []) {
    if (field === "schedule") {
      const parts = scheduleChangeParts(details.before?.schedule, details.after?.schedule, passes);
      if (parts) {
        schedule = parts;
        continue;
      }
    }
    fields.push(
      `${FIELD_LABELS[field]} ${fieldValue(field, details.before, passes)} → ${fieldValue(field, details.after, passes)}`,
    );
  }
  return [...(fields.length ? [`changed ${fields.join(", ")}`] : []), ...schedule];
};

/** A stop's or restart's own words ("Discontinued: side effects", "Resumed"), or null for an edit. */
const stopOrRestart = (details: MedicationChangeDetails) => {
  if (details.change === "resumed") return "Resumed";
  if (details.change !== "stopped") return null;
  const status = details.stopStatus ?? "discontinued";
  const reason =
    status === "discontinued" && details.stopReason
      ? `: ${STOP_REASON_LABELS[details.stopReason].toLowerCase()}`
      : "";
  return `${STATUS_LABELS[status]}${reason}`;
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * What a change entry says: "Started", "Changed dose 1 tablet → 2 tablets",
 * "Added to Evening", "Morning amount 500 mg → 1000 mg", "Discontinued: side
 * effects", "Completed", "Resumed". A stop or restart saved with field edits
 * adds them ("Resumed; changed dose …"). `passes` (deleted ones too) name the
 * passes a schedule edit touched.
 */
export const changeText = (details: MedicationChangeDetails, passes: readonly SchedulePass[] = []) => {
  if (details.change === "started") return "Started";
  const edits = editsText(details, passes);
  const lead = stopOrRestart(details);
  const parts = lead ? [lead, ...edits] : edits;
  return parts.length ? capitalized(parts.join("; ")) : "Changed";
};

/** What a pass-moved entry says: "Morning moved 8:00 → 8:30". */
export const passMovedText = ({ passName, beforeTime, afterTime }: PassMovedDetails) =>
  `${passName} moved ${clockTime(beforeTime)} → ${clockTime(afterTime)}`;

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

const TIMES_WORDS = ["", "once", "twice"];

/** "twice", "3 times". */
const timesWord = (n: number) => TIMES_WORDS[n] ?? `${n} times`;

/**
 * A slot given more than once, in words, or null when it was given once:
 * "Given twice: 8:00 and 8:20" (each dose's time in the recipient's zone).
 */
export const extraDoseText = (
  slot: Pick<DoseSlot, "dose" | "extra"> & { state: DoseSlot["state"] },
  timeZone: string,
) => {
  if (slot.state !== "given" || !slot.dose || !slot.extra.length) return null;
  const doses = [slot.dose, ...slot.extra].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return `Given ${timesWord(doses.length)}: ${listText(doses.map((d) => clockAt(d.occurredAt, timeZone)))}`;
};

/**
 * An as-needed day past its maximum, in words, or null within it: "Given 3
 * times today (most 2 a day): 8:00, 12:00 and 16:00".
 */
export const overMaxText = (
  item: { count: number; max: number | null; extra: readonly unknown[]; givenAt: readonly string[] },
  timeZone: string,
) =>
  item.max === null || !item.extra.length
    ? null
    : `Given ${timesWord(item.count)} today (most ${item.max} a day): ${listText(
        item.givenAt.map((at) => clockAt(at, timeZone)),
      )}`;

/** A due slot as a Due now item or Dose sheet choice: "Metformin 500 mg · 20:00 dose, overdue". */
export const dueSlotLabel = (
  slot: Pick<DoseSlot, "time" | "state"> & { medication: { name: string; strength?: string | null } },
) =>
  `${medicationTitle(slot.medication)} · ${clockTime(slot.time)} dose${slot.state === "overdue" ? ", overdue" : ""}`;

// ---------------------------------------------------------------------------
// Passes as Today, the Dose sheet and Upcoming show them (`duePasses`)
// ---------------------------------------------------------------------------

/** What pass wording needs of a `DuePass`. */
type PassWording = {
  name: string | null;
  time: string;
  state: "upcoming" | "due" | "overdue" | "done";
  partly: boolean;
  open: readonly unknown[];
  slots: readonly { medication: { name: string; strength?: string | null } }[];
};

/** A pass's name, or, for a time of its own, its medication: "Morning", "Metformin 500 mg". */
export const passTitle = (pass: Pick<PassWording, "name" | "slots">) =>
  pass.name ?? (pass.slots[0] ? medicationTitle(pass.slots[0].medication) : "");

/** A pass's state as it reads: "Later", "Due", "Overdue", "Done"; while partly done, "Due · 1 left". */
export const passStateText = (pass: Pick<PassWording, "state" | "partly" | "open">) => {
  const state = { upcoming: "Later", due: "Due", overdue: "Overdue", done: "Done" }[pass.state];
  return pass.partly ? `${state} · ${pass.open.length} left` : state;
};

/** "1 medication", "3 medications". */
export const medicationCountText = (count: number) => `${count} medication${count === 1 ? "" : "s"}`;

/** Who logged a pass so far: "Ann logged 2 of 3", "Ann and you logged 3 of 3", or null. */
export const passLoggedText = (
  pass: Pick<PassWording, "slots" | "open"> & { loggedBy: readonly { userId: string }[] },
  nameOf: (userId: string) => string,
) => {
  if (!pass.loggedBy.length) return null;
  const logged = pass.slots.length - pass.open.length;
  return `${listText(pass.loggedBy.map((l) => nameOf(l.userId)))} logged ${logged} of ${pass.slots.length}`;
};

/** What Undo's status says after Given all: "Morning logged", "Metformin 500 mg logged". */
export const passLoggedLabel = (pass: Pick<PassWording, "name" | "slots">) => `${passTitle(pass)} logged`;

/**
 * A due pass as one tap (quick entry's chip, easy mode's Now block): "Give
 * evening meds (4)", with how many are still open. A pass already called
 * "… meds" isn't doubled; a time of its own is named by its medication.
 */
export const givePassText = (pass: Pick<PassWording, "name" | "slots" | "open">) => {
  const title = pass.name ? pass.name.trim().toLocaleLowerCase("en-US") : passTitle(pass);
  const meds = !pass.name || /\b(meds|medications?|medicines?|pills)$/i.test(title) ? "" : " meds";
  return `Give ${title}${meds} (${pass.open.length})`;
};

/** Given all's accessible name: "Given all: Morning, 8:00". */
export const givenAllLabel = (pass: Pick<PassWording, "name" | "slots" | "time">) =>
  `Given all: ${passTitle(pass)}, ${clockTime(pass.time)}`;

// ---------------------------------------------------------------------------
// Pass logs on the timeline (`groupPassLogs`)
// ---------------------------------------------------------------------------

/**
 * A pass log's line on the timeline: "Morning: 3 given, 1 refused". The
 * counts read given, skipped, refused, leaving out none; a log whose pass
 * isn't on the device is "Medications".
 */
export const passLogText = (
  name: string | null | undefined,
  counts: Record<DoseDetails["status"], number>,
) => {
  const parts = (["given", "skipped", "refused"] as const)
    .filter((status) => counts[status] > 0)
    .map((status) => `${counts[status]} ${status}`);
  return `${name?.trim() || "Medications"}: ${parts.join(", ") || "nothing logged"}`;
};
