import type {
  ContactPhone,
  InsurancePlan,
  MedicationContent,
  OutsideContact,
  ProviderPhone,
  ProviderStatus,
  ProviderType,
} from "@caretook/data/schema";
import type { EmergencyMemberRow } from "../../../../../lib/emergencyList";
import type { BasicLine } from "../../../../../lib/recipientDisplay";

import { emergencyEntries } from "../../../../../lib/emergencyList";
import { formatDate, medicationTitle, scheduleText } from "../../../../../lib/medicationDisplay";
import { PROVIDER_TYPE_META } from "../../../../../lib/providerDirectory";
import { INSURANCE_RANK_LABELS, plansByRank, planTitle } from "../../../../../lib/recipientDetails";
import { ageText, basicLines, birthdayText } from "../../../../../lib/recipientDisplay";
import { dayInZone } from "../../../../../lib/zonedDay";

// The printable emergency sheet's view model (profiles slice 6): what
// `profile/print` shows, in the order it shows it. Pure: no React or database
// here; web:unit tests it, and the page renders it from the device's local
// copy (so it opens and prints offline). Imports are relative so web:unit can
// load it without Vite.

export type EmergencyRecipientInput = {
  name: string;
  preferredName?: string | null;
  /** "YYYY-MM-DD", or null when it isn't recorded. */
  dateOfBirth: string | null;
  /** The recipient's IANA zone: the age and the day printed are the recipient's. */
  timeZone: string | null;
  codeStatus: string | null;
  bloodType: string | null;
  primaryLanguage: string | null;
  pronouns: string | null;
  /** The note for helpers. */
  notes: string | null;
};

export type EmergencyDetailsInput = {
  phones: readonly ContactPhone[];
  address: string | null;
  insurance: readonly InsurancePlan[];
  outsideContacts: readonly OutsideContact[];
};

export type EmergencyMedicationInput = Pick<
  MedicationContent,
  "name" | "strength" | "dose" | "directions" | "schedule" | "status" | "pharmacyId"
> & { id: string; deletedAt?: string | null };

export type EmergencyProviderInput = {
  id: string;
  type: ProviderType;
  name: string;
  specialty?: string | null;
  phones: readonly ProviderPhone[];
  isPrimary: boolean;
  status: ProviderStatus;
  deletedAt?: string | null;
};

/** Allergies (B-26 isn't built yet): the section shows only when a list with entries is given. */
export type EmergencyAllergyInput = { name: string; reaction?: string | null };

export type SheetPhone = { label: string | null; number: string };

export type EmergencySection =
  | { id: "basics"; title: "Basics"; lines: BasicLine[] }
  | { id: "note"; title: "Note for helpers"; text: string }
  | { id: "contact"; title: "Address and phones"; address: string | null; phones: SheetPhone[] }
  | {
      id: "insurance";
      title: "Insurance";
      plans: {
        id: string;
        /** "Primary", "Secondary", "Other". */
        rank: string;
        /** "Medicare · Part A and B". */
        title: string;
        memberId: string;
        groupNumber: string | null;
        phone: string | null;
      }[];
    }
  | {
      id: "emergency";
      title: "Emergency contacts";
      contacts: {
        key: string;
        /** 1, 2, 3…: first to call first. */
        position: number;
        name: string;
        relationship: string | null;
        isPrimary: boolean;
        phones: SheetPhone[];
      }[];
    }
  | {
      id: "medications";
      title: "Current medications";
      medications: {
        id: string;
        /** "Lisinopril 10 mg". */
        title: string;
        /** "1 tablet · 8:00 and 20:00". */
        howTaken: string;
        directions: string | null;
      }[];
    }
  | { id: "allergies"; title: "Allergies"; allergies: { name: string; reaction: string | null }[] }
  | {
      id: "careTeam";
      title: "Care team";
      providers: {
        id: string;
        name: string;
        /** The specialty, else the type ("Pharmacy", "Practice"). */
        role: string;
        phone: SheetPhone | null;
      }[];
    };

export type EmergencySectionId = EmergencySection["id"];

/** The sections' order on the sheet. */
export const EMERGENCY_SECTION_ORDER: readonly EmergencySectionId[] = [
  "basics",
  "note",
  "contact",
  "insurance",
  "emergency",
  "medications",
  "allergies",
  "careTeam",
];

export type EmergencySheet = {
  recipient: {
    /** "Pat Example (Grandma Pat)" when a preferred name differs, else the name. */
    name: string;
    /** "March 14, 1941", or null. */
    born: string | null;
    /** "Age 85" on the recipient's day, or null. */
    age: string | null;
  };
  /** The recipient's day when printed: "Nov 18, 2026". */
  printedOn: string;
  /** Only the sections with something in them, in `EMERGENCY_SECTION_ORDER`. */
  sections: EmergencySection[];
};

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: { name: string; id: string }, b: { name: string; id: string }) =>
  collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const blank = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

const sheetPhone = (phone: { label?: string | null; number: string }): SheetPhone | null => {
  const number = phone.number.trim();
  return number ? { label: blank(phone.label), number } : null;
};
const sheetPhones = (phones: readonly { label?: string | null; number: string }[]) =>
  phones.flatMap((p) => sheetPhone(p) ?? []);

const recipientName = ({ name, preferredName }: EmergencyRecipientInput) => {
  const preferred = blank(preferredName);
  const full = blank(name) ?? "";
  if (!preferred || collator.compare(preferred, full) === 0) return full || preferred || "";
  return full ? `${full} (${preferred})` : preferred;
};

const todayIn = (now: Date, timeZone: string | null | undefined) => {
  try {
    return dayInZone(now, timeZone || "UTC");
  } catch {
    return dayInZone(now, "UTC");
  }
};

/**
 * The care team: current, not deleted providers marked primary (clinicians,
 * practices and other contacts by name, then pharmacies by name); when none
 * of them is a pharmacy, the pharmacies current medications are filled at.
 */
const careTeam = (
  providers: readonly EmergencyProviderInput[],
  medications: readonly EmergencyMedicationInput[],
) => {
  const live = providers.filter((p) => !p.deletedAt && p.status === "current");
  const primary = live.filter((p) => p.isPrimary);
  const team = new Map(primary.map((p) => [p.id, p]));
  if (!primary.some((p) => p.type === "pharmacy")) {
    const filledAt = new Set(medications.flatMap((m) => (m.pharmacyId ? [m.pharmacyId] : [])));
    for (const p of live) if (p.type === "pharmacy" && filledAt.has(p.id)) team.set(p.id, p);
  }
  return [...team.values()]
    .sort((a, b) => Number(a.type === "pharmacy") - Number(b.type === "pharmacy") || byName(a, b))
    .map((p) => ({
      id: p.id,
      name: p.name,
      role: blank(p.specialty) ?? PROVIDER_TYPE_META[p.type].label,
      phone: p.phones.map(sheetPhone).find((x) => x !== null) ?? null,
    }));
};

/**
 * The emergency sheet for a care recipient: the name, birthday and age, the
 * day printed (both on the recipient's own day), then, in order and only
 * when there's something to show:
 *
 * - basics (code status first, blood type, language, pronouns);
 * - the note for helpers;
 * - address and phones;
 * - insurance, by rank;
 * - emergency contacts in the group's one order across members and outside
 *   contacts, the primary contact marked;
 * - current medications (not completed, discontinued or deleted) by name,
 *   with dose and schedule;
 * - allergies, when given (B-26);
 * - the care team: primary providers and the pharmacy, with a phone each.
 *
 * `locale` is for tests; screens pass none.
 */
export const emergencySheet = ({
  recipient,
  details,
  members,
  medications,
  providers,
  allergies,
  now,
  locale,
}: {
  recipient: EmergencyRecipientInput | null;
  details: EmergencyDetailsInput;
  members: readonly EmergencyMemberRow[];
  medications: readonly EmergencyMedicationInput[];
  providers: readonly EmergencyProviderInput[];
  allergies?: readonly EmergencyAllergyInput[] | null;
  now: Date;
  locale?: string;
}): EmergencySheet => {
  const zone = recipient?.timeZone ?? null;
  const sections: EmergencySection[] = [];

  const lines = recipient ? basicLines(recipient) : [];
  if (lines.length) sections.push({ id: "basics", title: "Basics", lines });

  const note = blank(recipient?.notes);
  if (note) sections.push({ id: "note", title: "Note for helpers", text: note });

  const address = blank(details.address);
  const phones = sheetPhones(details.phones);
  if (address || phones.length)
    sections.push({ id: "contact", title: "Address and phones", address, phones });

  const plans = plansByRank(details.insurance).map((p) => ({
    id: p.id,
    rank: INSURANCE_RANK_LABELS[p.rank],
    title: planTitle(p),
    memberId: p.memberId,
    groupNumber: blank(p.groupNumber),
    phone: blank(p.phone),
  }));
  if (plans.length) sections.push({ id: "insurance", title: "Insurance", plans });

  const contacts = emergencyEntries(members, details.outsideContacts).map((e, i) => ({
    key: e.key,
    position: i + 1,
    name: e.name,
    relationship: e.relationship,
    isPrimary: e.isPrimary,
    phones: sheetPhones(e.phones),
  }));
  if (contacts.length) sections.push({ id: "emergency", title: "Emergency contacts", contacts });

  const current = medications.filter((m) => !m.deletedAt && m.status === "current");
  const meds = [...current].sort(byName).map((m) => ({
    id: m.id,
    title: medicationTitle(m),
    howTaken: [blank(m.dose), scheduleText(m.schedule)].filter(Boolean).join(" · "),
    directions: blank(m.directions),
  }));
  if (meds.length) sections.push({ id: "medications", title: "Current medications", medications: meds });

  const allergyRows = (allergies ?? []).flatMap((a) => {
    const name = blank(a.name);
    return name ? [{ name, reaction: blank(a.reaction) }] : [];
  });
  if (allergyRows.length) sections.push({ id: "allergies", title: "Allergies", allergies: allergyRows });

  const team = careTeam(providers, current);
  if (team.length) sections.push({ id: "careTeam", title: "Care team", providers: team });

  return {
    recipient: {
      name: recipient ? recipientName(recipient) : "",
      born: recipient?.dateOfBirth ? birthdayText(recipient.dateOfBirth, locale) : null,
      age: recipient ? ageText(recipient.dateOfBirth, zone, now) : null,
    },
    printedOn: formatDate(todayIn(now, zone), locale),
    sections,
  };
};
