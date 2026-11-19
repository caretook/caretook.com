import type { GroupRoleName } from "../../constants/roles";
import type { ContactPhone } from "./contactFields";
import type { SharedField } from "./memberContactShare";
import type { ContactValues } from "./userContact";

import { SHARED_FIELDS } from "./memberContactShare";

// Who sees and edits what on a recipient's profile, and what a member's
// sharing choices show a group (profiles). Pure and client-safe: screens,
// services and tests all use it.

/**
 * The recipient's fields in groups that share one rule:
 * - `identity`: name, preferred name, birthday (and time zone)
 * - `basics`: code status, blood type, language, pronouns, the note for helpers
 * - `details`: phones, email, address, insurance (`care_recipient_details`)
 * - `outsideContacts`: people without an account on the emergency list
 */
export const RECIPIENT_FIELD_GROUPS = ["identity", "basics", "details", "outsideContacts"] as const;
export type RecipientFieldGroup = (typeof RECIPIENT_FIELD_GROUPS)[number];

export const RECIPIENT_FIELDS = {
  identity: ["name", "preferredName", "dateOfBirth", "timeZone"],
  basics: ["codeStatus", "bloodType", "primaryLanguage", "pronouns", "notes"],
  details: ["phones", "email", "address", "insurance"],
  outsideContacts: ["outsideContacts"],
} as const satisfies Record<RecipientFieldGroup, readonly string[]>;

const EVERYONE: readonly GroupRoleName[] = ["owner", "admin", "caretaker", "viewer"];
const WRITERS: readonly GroupRoleName[] = ["owner", "admin", "caretaker"];
const MANAGERS: readonly GroupRoleName[] = ["owner", "admin"];

const READ: Record<RecipientFieldGroup, readonly GroupRoleName[]> = {
  identity: EVERYONE,
  basics: EVERYONE,
  details: WRITERS,
  outsideContacts: WRITERS,
};

const EDIT: Record<RecipientFieldGroup, readonly GroupRoleName[]> = {
  identity: WRITERS,
  basics: WRITERS,
  details: WRITERS,
  outsideContacts: MANAGERS,
};

type Role = GroupRoleName | null | undefined;

/** Whether a member with `role` reads this group of the recipient's fields. Non-members read nothing. */
export const canReadRecipient = (role: Role, group: RecipientFieldGroup) =>
  !!role && READ[group].includes(role);

/** Whether a member with `role` edits this group of the recipient's fields. */
export const canEditRecipient = (role: Role, group: RecipientFieldGroup) =>
  !!role && EDIT[group].includes(role);

/** The field groups a member with `role` reads, in order. */
export const readableRecipientGroups = (role: Role) =>
  RECIPIENT_FIELD_GROUPS.filter((group) => canReadRecipient(role, group));

/** Owners and admins set the emergency order and the primary contact. */
export const canManageEmergencyContacts = (role: Role) => !!role && MANAGERS.includes(role);

/** What a member shares with one group: only the chosen fields' values, null for the rest. */
export type SharedContact = {
  phones: ContactPhone[] | null;
  email: string | null;
  address: string | null;
};

/**
 * What a group sees of a member's contact details, given their choices. A
 * field is shared only when chosen and filled in: an empty phone list or
 * blank address shares nothing.
 */
export const sharedContact = (
  contact: ContactValues | null | undefined,
  sharedFields: readonly SharedField[] | null | undefined,
): SharedContact => {
  const chosen = new Set(sharedFields ?? []);
  const phones = contact?.phones ?? [];
  return {
    phones: chosen.has("phones") && phones.length ? phones : null,
    email: (chosen.has("email") && contact?.contactEmail) || null,
    address: (chosen.has("address") && contact?.address) || null,
  };
};

/** The fields a group actually sees, in order. */
export const visibleSharedFields = (share: SharedContact): SharedField[] =>
  SHARED_FIELDS.filter((field) => {
    const value = share[field];
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

/** Whether the share shows anything at all. */
export const sharesAnything = (share: SharedContact) => visibleSharedFields(share).length > 0;

/**
 * Only members sharing a phone can be emergency contacts or the primary
 * contact: the list never shows someone with no number.
 */
export const canBeEmergencyContact = (share: SharedContact | null | undefined) =>
  !!share?.phones && share.phones.length > 0;
