import type { ContactPhone, ContactValues, SharedField } from "@caretook/data/schema";
import type { ContactAction } from "../providers/contactActions";

import { callAction, mailtoHref, mapsHref, textAction } from "../providers/contactActions";
import type { SharedContact } from "@caretook/data/domain";
import { SHARED_FIELDS } from "@caretook/data/domain";

// Members' contact details on a group's Members page (profiles): what each
// member shares with the group (the synced `member_contact_share` row) as
// links, and your own choices for the group ("What this group sees"). Pure,
// so web:unit tests it.

/** What each shareable field is called. */
export const SHARED_FIELD_LABELS: Record<SharedField, string> = {
  phones: "Phone numbers",
  email: "Contact email",
  address: "Address",
};

/** Below the choices: where the values come from, and that nothing else is shown. */
export const SHARING_HELP = "Only what you tick is shown to this group. Your sign-in email is never shown.";

/** Your own row with no contact details saved: where to add them. */
export const NO_CONTACT_YET = "You haven't added any contact details yet.";

const parseJson = (text: string | null | undefined): unknown => {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** A membership's `shared_fields` (JSON text on the device): the known fields, in order. */
export const parseSharedFields = (text: string | null | undefined): SharedField[] => {
  const value = parseJson(text);
  if (!Array.isArray(value)) return [];
  return SHARED_FIELDS.filter((field) => value.some((v) => v === field));
};

/** Phones as JSON text on the device: the well-formed ones. */
export const parsePhones = (text: string | null | undefined): ContactPhone[] => {
  const value = parseJson(text);
  if (!Array.isArray(value)) return [];
  return value.flatMap((p: unknown) => {
    if (typeof p !== "object" || p === null) return [];
    const { label, number } = p as { label?: unknown; number?: unknown };
    return typeof number === "string" && number.trim()
      ? [{ label: typeof label === "string" ? label : "", number }]
      : [];
  });
};

/** A member's share row's columns, as the device has them. */
export type ShareColumns = {
  share_phones: string | null;
  share_email: string | null;
  share_address: string | null;
};

/** What a member shows the group, from their synced share row (none: nothing). */
export const memberShare = (row: ShareColumns): SharedContact => {
  const phones = parsePhones(row.share_phones);
  return {
    phones: phones.length ? phones : null,
    email: row.share_email?.trim() || null,
    address: row.share_address?.trim() || null,
  };
};

/** One line of a member's shared details: the link, what it shows, a caption, and a text action for numbers. */
export type MemberContactLine = {
  field: SharedField;
  action: ContactAction;
  /** What the line shows: the number, the email, the address on one line. */
  text: string;
  /** A number's label ("Mobile"), or null. */
  caption: string | null;
  /** Text this number; null for anything else. */
  sms: ContactAction | null;
};

const oneLine = (address: string) =>
  address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(", ");

/**
 * A member's shared details as links: each number (call, with a text action
 * beside it), then the email and the address (maps). Only what makes a link.
 */
export const memberContactLines = (name: string, share: SharedContact): MemberContactLine[] => {
  const lines: MemberContactLine[] = [];
  for (const phone of share.phones ?? []) {
    const action = callAction(name, phone);
    if (!action) continue;
    lines.push({
      field: "phones",
      action,
      text: phone.number.trim(),
      caption: phone.label.trim() || null,
      sms: textAction(name, phone),
    });
  }
  const mailto = share.email ? mailtoHref(share.email) : null;
  if (share.email && mailto)
    lines.push({
      field: "email",
      action: { kind: "email", href: mailto, label: `Email ${name}`, value: share.email },
      text: share.email.trim(),
      caption: null,
      sms: null,
    });
  const maps = share.address ? mapsHref(share.address) : null;
  if (share.address && maps)
    lines.push({
      field: "address",
      action: { kind: "map", href: maps, label: `Open ${name}'s address in maps`, value: share.address },
      text: oneLine(share.address),
      caption: null,
      sms: null,
    });
  return lines;
};

/** One choice under "What this group sees": a field you've filled in. */
export type SharingOption = {
  field: SharedField;
  label: string;
  /** What ticking it shows ("(555) 010-1234, (555) 010-5678"). */
  preview: string;
  checked: boolean;
};

const hasValue = (contact: ContactValues, field: SharedField) =>
  field === "phones"
    ? contact.phones.length > 0
    : field === "email"
      ? !!contact.contactEmail?.trim()
      : !!contact.address?.trim();

const preview = (contact: ContactValues, field: SharedField) =>
  field === "phones"
    ? contact.phones.map((p) => p.number.trim()).join(", ")
    : field === "email"
      ? (contact.contactEmail ?? "").trim()
      : oneLine(contact.address ?? "");

/**
 * The choices your own row offers: only the fields you've filled in on your
 * account, each ticked when this group already sees it. Nothing is ticked
 * until you choose.
 */
export const sharingOptions = (
  contact: ContactValues,
  sharedFields: readonly SharedField[],
): SharingOption[] =>
  SHARED_FIELDS.filter((field) => hasValue(contact, field)).map((field) => ({
    field,
    label: SHARED_FIELD_LABELS[field],
    preview: preview(contact, field),
    checked: sharedFields.includes(field),
  }));

/** The sharing form's field names. */
export const SHARING_FIELD = { share: "share", relationship: "relationship" } as const;

/** Your choices in a submitted sharing form, as `careGroup.updateMySharing` takes them. */
export const sharingFromForm = (form: FormData) => {
  const relationship = form.get(SHARING_FIELD.relationship);
  return {
    sharedFields: SHARED_FIELDS.filter((field) => form.getAll(SHARING_FIELD.share).includes(field)),
    relationship: typeof relationship === "string" ? relationship : "",
  };
};

/** "Shares phone numbers and address with this group", or that nothing is shared. */
export const sharedSummary = (fields: readonly SharedField[]) => {
  if (fields.length === 0) return "You share nothing with this group.";
  const names = fields.map((f) => SHARED_FIELD_LABELS[f].toLowerCase());
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `You share your ${list} with this group.`;
};
