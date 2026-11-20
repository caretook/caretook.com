import type { ContactPhone, InsurancePlan, InsuranceRank, OutsideContact } from "@caretook/data/schema";
import type { ContactAction } from "../providers/contactActions";

import { INSURANCE_RANKS } from "@caretook/data/schema";
import { callAction } from "../providers/contactActions";
import { parsePhones } from "./memberContact";

// The recipient's writers-only details (profiles): phones, email, address,
// insurance plans and outside contacts, as the device has them (the synced
// `care_recipient_details` row, JSON as text) and as the profile shows them.
// Pure, so web:unit tests it.

/** The row's columns, as the device has them. */
export type RecipientDetailsRow = {
  id: string;
  group_id: string | null;
  phones: string | null;
  email: string | null;
  address: string | null;
  insurance: string | null;
  outside_contacts: string | null;
  updated_at: string | null;
};

export type RecipientDetails = {
  phones: ContactPhone[];
  email: string | null;
  address: string | null;
  insurance: InsurancePlan[];
  outsideContacts: OutsideContact[];
};

/** A recipient with nothing saved yet (no row). */
export const EMPTY_DETAILS: RecipientDetails = {
  phones: [],
  email: null,
  address: null,
  insurance: [],
  outsideContacts: [],
};

const parseArray = (text: string | null | undefined): unknown[] => {
  if (!text) return [];
  try {
    const value = JSON.parse(text) as unknown;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
const isRank = (value: unknown): value is InsuranceRank =>
  (INSURANCE_RANKS as readonly unknown[]).includes(value);

/** Insurance plans as JSON text: the well-formed ones (an insurer and a member ID). */
export const parseInsurance = (text: string | null | undefined): InsurancePlan[] =>
  parseArray(text).flatMap((value) => {
    if (typeof value !== "object" || value === null) return [];
    const p = value as Record<string, unknown>;
    const insurer = str(p.insurer).trim();
    const memberId = str(p.memberId).trim();
    if (!insurer || !memberId) return [];
    return [
      {
        id: str(p.id),
        rank: isRank(p.rank) ? p.rank : "other",
        insurer,
        planName: strOrNull(p.planName),
        memberId,
        groupNumber: strOrNull(p.groupNumber),
        phone: strOrNull(p.phone),
      },
    ];
  });

/** Outside contacts as JSON text: the well-formed ones (a name and a phone). */
export const parseOutsideContacts = (text: string | null | undefined): OutsideContact[] =>
  parseArray(text).flatMap((value) => {
    if (typeof value !== "object" || value === null) return [];
    const c = value as Record<string, unknown>;
    const name = str(c.name).trim();
    const phone = str(c.phone).trim();
    if (!name || !phone) return [];
    return [
      {
        id: str(c.id),
        name,
        relationship: strOrNull(c.relationship),
        phone,
        emergencyRank: typeof c.emergencyRank === "number" ? c.emergencyRank : null,
      },
    ];
  });

/** The device's row as details; none is empty. */
export const toRecipientDetails = (row: RecipientDetailsRow | null | undefined): RecipientDetails =>
  row
    ? {
        phones: parsePhones(row.phones),
        email: row.email?.trim() || null,
        address: row.address?.trim() || null,
        insurance: parseInsurance(row.insurance),
        outsideContacts: parseOutsideContacts(row.outside_contacts),
      }
    : EMPTY_DETAILS;

/** Whether there's anything in the Contact card. */
export const hasContact = (details: RecipientDetails) =>
  details.phones.length > 0 || !!details.email || !!details.address;

export const INSURANCE_RANK_LABELS: Record<InsuranceRank, string> = {
  primary: "Primary",
  secondary: "Secondary",
  other: "Other",
};

/** Plans in rank order (primary, secondary, then others), keeping their saved order within a rank. */
export const plansByRank = (plans: readonly InsurancePlan[]): InsurancePlan[] =>
  [...plans].sort((a, b) => INSURANCE_RANKS.indexOf(a.rank) - INSURANCE_RANKS.indexOf(b.rank));

/** "Medicare · Part A and B", or the insurer alone. */
export const planTitle = (plan: Pick<InsurancePlan, "insurer" | "planName">) =>
  plan.planName ? `${plan.insurer} · ${plan.planName}` : plan.insurer;

/** Call the insurer ("Call Medicare"), or null when the plan has no number to dial. */
export const insuranceCall = (plan: InsurancePlan): ContactAction | null =>
  plan.phone ? callAction(plan.insurer, { label: "", number: plan.phone }) : null;

/** What the Contact and Insurance sheets save, compared to what the device has. */
export type SavedDetails = Partial<Pick<RecipientDetails, "phones" | "email" | "address" | "insurance">>;

const phoneKey = (phones: readonly ContactPhone[]) =>
  JSON.stringify(phones.map((p) => [p.label.trim(), p.number.trim()]));
const planKey = (plans: readonly InsurancePlan[]) =>
  JSON.stringify(plans.map((p) => [p.id, p.rank, p.insurer, p.planName, p.memberId, p.groupNumber, p.phone]));

/**
 * Whether the device's details have every field a save set (the server's
 * answer). Key order doesn't matter (Postgres's jsonb reorders keys).
 */
export const detailsMatch = (device: RecipientDetails, saved: SavedDetails) =>
  (saved.phones === undefined || phoneKey(device.phones) === phoneKey(saved.phones)) &&
  (saved.email === undefined || device.email === (saved.email?.trim() || null)) &&
  (saved.address === undefined || device.address === (saved.address?.trim() || null)) &&
  (saved.insurance === undefined || planKey(device.insurance) === planKey(saved.insurance));
