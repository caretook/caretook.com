import type {
  MedicationContent,
  MedicationStatus,
  MedicationType,
  ProviderPhone,
  ProviderType,
} from "@caretook/data/schema";
import type { SchedulePass } from "../../../../../lib/medications/medicationDisplay";

import {
  FORM_LABELS,
  formatDate,
  MEDICATION_TYPE_GROUPS,
  medicationTitle,
  medicationTypeGroupHeading,
  scheduleText,
  STATUS_LABELS,
  STOP_REASON_LABELS,
} from "../../../../../lib/medications/medicationDisplay";

// The printable medication sheet's view model: what the print page shows, in
// the order it shows it. Pure: no React or database here; web:unit tests it,
// and the print page renders it from the device's local copy (so it works
// offline). Imports are relative so web:unit can load it without Vite.

/** How long a stopped medication stays on the sheet, in calendar days. */
export const RECENTLY_STOPPED_DAYS = 90;

export type PrintRecipient = {
  name: string;
  preferredName?: string | null;
  /** "YYYY-MM-DD", or null when it isn't recorded. */
  dateOfBirth: string | null;
  /** The recipient's IANA zone: the day printed is the recipient's day. */
  timeZone: string | null;
};

export type PrintMedicationInput = Pick<
  MedicationContent,
  | "name"
  | "strength"
  | "form"
  | "dose"
  | "directions"
  | "reason"
  | "schedule"
  | "status"
  | "startedOn"
  | "stoppedOn"
  | "stopReason"
  | "stopNote"
  | "prescriberId"
  | "pharmacyId"
> & { id: string; /** Missing reads as not set. */ type?: MedicationType | null; deletedAt?: string | null };

export type PrintProviderInput = {
  id: string;
  type: ProviderType;
  name: string;
  phones: ProviderPhone[];
  deletedAt?: string | null;
};

export type PrintCurrentRow = {
  id: string;
  /** "Lisinopril 10 mg". */
  title: string;
  form: string | null;
  dose: string | null;
  directions: string | null;
  /** "Morning and Evening", "Morning (1000 mg) and 14:00", "As needed, up to 4 a day". */
  schedule: string;
  reason: string | null;
  prescriber: string | null;
  /** "Jul 21, 2026", or null. */
  started: string | null;
};

export type PrintTypeGroup = {
  /** Null for the medications with no type. */
  type: MedicationType | null;
  /** "Prescriptions", "Supplements", "Type not set". */
  heading: string;
  rows: PrintCurrentRow[];
};

export type PrintStoppedRow = {
  id: string;
  title: string;
  status: Exclude<MedicationStatus, "current">;
  /** "Completed", "Discontinued". */
  statusLabel: string;
  /** "Nov 4, 2026". */
  stopped: string;
  /** "Side effects: dry mouth, confusion", or null (a completed course). */
  why: string | null;
};

export type PrintContactRole = "Prescriber" | "Pharmacy" | "Prescriber and pharmacy";

export type PrintContact = {
  id: string;
  name: string;
  role: PrintContactRole;
  /** The provider's first phone, or null when there is none. */
  phone: ProviderPhone | null;
};

export type PrintSheet = {
  recipient: {
    /** "Patricia Holloway (Grandma Pat)" when a preferred name differs, else the name. */
    name: string;
    /** "Mar 14, 1941", or null. */
    dateOfBirth: string | null;
  };
  groupName: string;
  /** The recipient's day when printed: "Nov 18, 2026". */
  printedOn: string;
  /** Current medications, grouped by type: a group for each type that has any, Type not set last. */
  currentGroups: PrintTypeGroup[];
  /** The same rows, flat, in group order. */
  current: PrintCurrentRow[];
  stopped: PrintStoppedRow[];
  contacts: PrintContact[];
};

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const blank = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

const isZone = (timeZone: string | null | undefined): timeZone is string => {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

/** The calendar day ("YYYY-MM-DD") it is in `timeZone` (the device's when it's missing or unknown). */
export const dayIn = (now: Date, timeZone: string | null | undefined) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      ...(isZone(timeZone) ? { timeZone } : {}),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** `day` ("YYYY-MM-DD") moved by `days` calendar days. */
export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const recipientName = ({ name, preferredName }: PrintRecipient) => {
  const preferred = blank(preferredName);
  const full = blank(name) ?? "";
  if (!preferred || collator.compare(preferred, full) === 0) return full || preferred || "";
  return full ? `${full} (${preferred})` : preferred;
};

/**
 * The sheet for a group's medications:
 *
 * - current medications, grouped by type (Prescription, Over the counter,
 *   Supplement, Other, then none; empty groups left out), each by name;
 * - medications completed or discontinued in the last 90 days (the stop day
 *   on or after the recipient's today less 90), most recently stopped first;
 * - every prescriber and pharmacy those name, once each (a provider that is
 *   both says so), prescribers then pharmacies, each by name, with its first
 *   phone. A provider deleted since keeps its name in the table but isn't
 *   listed to call.
 *
 * Deleted medications are left out. `locale` is for tests; screens pass none.
 */
export const printSheet = ({
  recipient,
  groupName = "",
  medications,
  providers,
  passes = [],
  now,
  locale,
}: {
  recipient: PrintRecipient | null;
  groupName?: string;
  medications: readonly PrintMedicationInput[];
  providers: readonly PrintProviderInput[];
  /** The group's passes, deleted ones too: schedules read by pass name. */
  passes?: readonly SchedulePass[];
  now: Date;
  locale?: string;
}): PrintSheet => {
  const today = dayIn(now, recipient?.timeZone);
  const cutoff = addDays(today, -RECENTLY_STOPPED_DAYS);
  const live = medications.filter((m) => !m.deletedAt);
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => (id ? (providerById.get(id)?.name ?? null) : null);

  const currentLive = live.filter((m) => m.status === "current");
  const currentMeds = MEDICATION_TYPE_GROUPS.flatMap((type) =>
    currentLive.filter((m) => (m.type ?? null) === type).sort(byName),
  );
  const stoppedMeds = live
    .filter(
      (m): m is PrintMedicationInput & { status: "completed" | "discontinued"; stoppedOn: string } =>
        m.status !== "current" && !!m.stoppedOn && m.stoppedOn >= cutoff,
    )
    .sort((a, b) => (a.stoppedOn < b.stoppedOn ? 1 : a.stoppedOn > b.stoppedOn ? -1 : byName(a, b)));

  const currentRows = new Map<string, PrintCurrentRow>();
  for (const m of currentMeds)
    currentRows.set(m.id, {
      id: m.id,
      title: medicationTitle(m),
      form: m.form ? FORM_LABELS[m.form] : null,
      dose: blank(m.dose),
      directions: blank(m.directions),
      schedule: scheduleText(m.schedule, passes, m.dose),
      reason: blank(m.reason),
      prescriber: nameOf(m.prescriberId),
      started: m.startedOn ? formatDate(m.startedOn, locale) : null,
    });
  const currentGroups: PrintTypeGroup[] = MEDICATION_TYPE_GROUPS.flatMap((type) => {
    const rows = currentMeds
      .filter((m) => (m.type ?? null) === type)
      .map((m) => currentRows.get(m.id) as PrintCurrentRow);
    return rows.length ? [{ type, heading: medicationTypeGroupHeading(type), rows }] : [];
  });
  const current = currentGroups.flatMap((g) => g.rows);

  const stopped: PrintStoppedRow[] = stoppedMeds.map((m) => {
    const reason = m.status === "discontinued" && m.stopReason ? STOP_REASON_LABELS[m.stopReason] : null;
    const note = blank(m.stopNote);
    return {
      id: m.id,
      title: medicationTitle(m),
      status: m.status,
      statusLabel: STATUS_LABELS[m.status],
      stopped: formatDate(m.stoppedOn, locale),
      why: reason && note ? `${reason}: ${note}` : (reason ?? note),
    };
  });

  // Who to call: every prescriber and pharmacy on the sheet, once.
  const roles = new Map<string, { prescriber: boolean; pharmacy: boolean }>();
  const mark = (id: string | null, role: "prescriber" | "pharmacy") => {
    if (!id) return;
    const seen = roles.get(id) ?? { prescriber: false, pharmacy: false };
    seen[role] = true;
    roles.set(id, seen);
  };
  for (const m of [...currentMeds, ...stoppedMeds]) {
    mark(m.prescriberId, "prescriber");
    mark(m.pharmacyId, "pharmacy");
  }
  const contacts = [...roles]
    .flatMap(([id, role]): PrintContact[] => {
      const provider = providerById.get(id);
      if (!provider || provider.deletedAt) return [];
      const label: PrintContactRole =
        role.prescriber && role.pharmacy
          ? "Prescriber and pharmacy"
          : role.prescriber
            ? "Prescriber"
            : "Pharmacy";
      const phone = provider.phones.find((p) => blank(p.number)) ?? null;
      return [{ id, name: provider.name, role: label, phone }];
    })
    .sort((a, b) => Number(a.role === "Pharmacy") - Number(b.role === "Pharmacy") || byName(a, b));

  return {
    recipient: {
      name: recipient ? recipientName(recipient) : "",
      dateOfBirth: recipient?.dateOfBirth ? formatDate(recipient.dateOfBirth, locale) : null,
    },
    groupName,
    printedOn: formatDate(today, locale),
    currentGroups,
    current,
    stopped,
    contacts,
  };
};
