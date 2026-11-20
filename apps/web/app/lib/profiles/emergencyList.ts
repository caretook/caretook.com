import type { ContactPhone, EmergencyRef, OutsideContact, OutsideContactInput } from "@caretook/data/schema";
import type { MemberContactLine } from "./memberContact";

import { emergencyOrder, emergencyRefKey } from "@caretook/data/schema";
import { callAction, textAction } from "../providers/contactActions";
import { parsePhones } from "./memberContact";

// The group's emergency list (profiles slice 5), as the profile, its
// `profile/emergency` sheet and the Members page's badges show it: one order
// across members (their membership's rank) and outside contacts (people
// without an account), and one member marked as the primary contact. Pure,
// so web:unit tests it.

/** A membership's emergency columns as the device has them (`is_primary_contact` is 1 or 0). */
export type EmergencyMemberRow = {
  user_id: string;
  name: string | null;
  relationship: string | null;
  emergency_rank: number | null;
  is_primary_contact: number | boolean | null;
  emergency_dropped_at: string | null;
  /** The phones they share with the group (JSON text), or null. */
  share_phones: string | null;
};

const memberName = (name: string | null) => name?.trim() || "Member";

/** One place on the list, ready to show. */
export type EmergencyEntry = {
  /** `member:<userId>` or `outside:<id>` (`emergencyRefKey`). */
  key: string;
  ref: EmergencyRef;
  name: string;
  relationship: string | null;
  phones: ContactPhone[];
  isPrimary: boolean;
};

const memberEntry = (m: EmergencyMemberRow): EmergencyEntry => ({
  key: emergencyRefKey({ kind: "member", userId: m.user_id }),
  ref: { kind: "member", userId: m.user_id },
  name: memberName(m.name),
  relationship: m.relationship?.trim() || null,
  phones: parsePhones(m.share_phones),
  isPrimary: !!m.is_primary_contact,
});

const outsideEntry = (c: OutsideContact): EmergencyEntry => ({
  key: emergencyRefKey({ kind: "outside", id: c.id }),
  ref: { kind: "outside", id: c.id },
  name: c.name,
  relationship: c.relationship?.trim() || null,
  phones: c.phone.trim() ? [{ label: "", number: c.phone }] : [],
  isPrimary: false,
});

const memberRank = (m: EmergencyMemberRow) => ({ userId: m.user_id, emergencyRank: m.emergency_rank });

/** The list in order, first to call first (ranks sorted, so a gap left by a removed member doesn't matter). */
export const emergencyEntries = (
  members: readonly EmergencyMemberRow[],
  outside: readonly OutsideContact[],
): EmergencyEntry[] => {
  const byUser = new Map(members.map((m) => [m.user_id, m]));
  const byId = new Map(outside.map((c) => [c.id, c]));
  return emergencyOrder(members.map(memberRank), outside).flatMap((ref) => {
    if (ref.kind === "member") {
      const m = byUser.get(ref.userId);
      return m ? [memberEntry(m)] : [];
    }
    const c = byId.get(ref.id);
    return c ? [outsideEntry(c)] : [];
  });
};

/** The primary contact's name, if there is one (on the list or not). */
export const primaryContactName = (members: readonly EmergencyMemberRow[]) => {
  const primary = members.find((m) => !!m.is_primary_contact);
  return primary ? memberName(primary.name) : null;
};

/** An entry's numbers as call (and text) links. */
export const emergencyPhoneLines = (entry: EmergencyEntry): MemberContactLine[] =>
  entry.phones.flatMap((phone) => {
    const action = callAction(entry.name, phone);
    if (!action) return [];
    return [
      {
        field: "phones" as const,
        action,
        text: phone.number.trim(),
        caption: phone.label.trim() || null,
        sms: textAction(entry.name, phone),
      },
    ];
  });

/**
 * The managers' note: members who fell off the list because they stopped
 * sharing a phone, until a manager saves the list again (or they're back on it).
 */
export const droppedNotes = (members: readonly EmergencyMemberRow[]): string[] =>
  members
    .filter((m) => m.emergency_dropped_at && m.emergency_rank == null)
    .map(
      (m) =>
        `${memberName(m.name)} stopped sharing a phone number with the group, so they're no longer on the list.`,
    );

/** The Members page's badges for one member. */
export const emergencyBadges = (m: Pick<EmergencyMemberRow, "emergency_rank" | "is_primary_contact">) => {
  const badges: string[] = [];
  if (m.is_primary_contact) badges.push("Primary contact");
  if (m.emergency_rank != null) badges.push("Emergency contact");
  return badges;
};

// The sheet's draft ----------------------------------------------------------

/** One row of the sheet's list: a member (read-only) or an outside contact (editable). */
export type DraftEntry =
  | { kind: "member"; key: string; userId: string; name: string; phones: ContactPhone[] }
  | { kind: "outside"; key: string; contact: OutsideContactInput & { id: string } };

/** What the sheet edits: the list, and the primary contact's user id (or none). */
export type EmergencyDraft = { entries: DraftEntry[]; primaryUserId: string | null };

/** The sheet's starting draft: the list as stored, then outside contacts not on it yet. */
export const initialDraft = (
  members: readonly EmergencyMemberRow[],
  outside: readonly OutsideContact[],
): EmergencyDraft => {
  const listed = emergencyEntries(members, outside);
  const entries: DraftEntry[] = listed.map((e) =>
    e.ref.kind === "member"
      ? { kind: "member", key: e.key, userId: e.ref.userId, name: e.name, phones: e.phones }
      : {
          kind: "outside",
          key: e.key,
          contact: outsideInput(outside.find((c) => e.ref.kind === "outside" && c.id === e.ref.id)!),
        },
  );
  for (const c of outside) {
    if (c.emergencyRank == null)
      entries.push({ kind: "outside", key: `outside:${c.id}`, contact: outsideInput(c) });
  }
  const primary = members.find((m) => !!m.is_primary_contact);
  return { entries, primaryUserId: primary?.user_id ?? null };
};

const outsideInput = (c: OutsideContact) => ({
  id: c.id,
  name: c.name,
  relationship: c.relationship ?? "",
  phone: c.phone,
});

/** A draft row's name, for buttons and announcements. */
export const draftName = (entry: DraftEntry) =>
  entry.kind === "member" ? entry.name : entry.contact.name.trim() || "New contact";

/** The draft with the row at `index` moved by `delta` (−1 up, +1 down); unchanged at the ends. */
export const moveEntry = <T>(entries: readonly T[], index: number, delta: -1 | 1): T[] => {
  const to = index + delta;
  if (index < 0 || index >= entries.length || to < 0 || to >= entries.length) return [...entries];
  const next = [...entries];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved!);
  return next;
};

/** What a screen reader hears after a move: "Rosa Example moved to 2 of 3." */
export const movedText = (name: string, position: number, total: number) =>
  `${name} moved to ${position} of ${total}.`;

/** Members who can be added: sharing a phone, and not on the draft yet, by name. */
export const addableMembers = (members: readonly EmergencyMemberRow[], draft: EmergencyDraft) => {
  const listed = new Set(draft.entries.flatMap((e) => (e.kind === "member" ? [e.userId] : [])));
  return members
    .filter((m) => !listed.has(m.user_id) && parsePhones(m.share_phones).length > 0)
    .map((m) => ({ userId: m.user_id, name: memberName(m.name), phones: parsePhones(m.share_phones) }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** Members who can't be added because they share no phone, by name. */
export const membersWithoutPhone = (members: readonly EmergencyMemberRow[]) =>
  members
    .filter((m) => parsePhones(m.share_phones).length === 0)
    .map((m) => memberName(m.name))
    .sort((a, b) => a.localeCompare(b));

/** "Sam and Lee don't share a phone number with the group, so they can't be added." */
export const withoutPhoneText = (names: readonly string[]) => {
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  const verb = names.length === 1 ? "doesn't" : "don't";
  return `${list} ${verb} share a phone number with the group, so they can't be added.`;
};

/** What the sheet posts (as JSON): the outside contacts, the order, and the primary contact. */
export type EmergencySave = {
  outside: (OutsideContactInput & { id: string })[];
  order: EmergencyRef[];
  primaryUserId: string | null;
};

/** The draft as the three calls take it. A primary contact no longer on the list is cleared. */
export const draftToSave = (draft: EmergencyDraft): EmergencySave => {
  const order: EmergencyRef[] = draft.entries.map((e) =>
    e.kind === "member" ? { kind: "member", userId: e.userId } : { kind: "outside", id: e.contact.id },
  );
  const onList = draft.entries.some((e) => e.kind === "member" && e.userId === draft.primaryUserId);
  return {
    outside: draft.entries.flatMap((e) =>
      e.kind === "outside"
        ? [
            {
              id: e.contact.id,
              name: e.contact.name,
              relationship: e.contact.relationship,
              phone: e.contact.phone,
            },
          ]
        : [],
    ),
    order,
    primaryUserId: onList ? draft.primaryUserId : null,
  };
};

/** The form field the sheet posts its draft in. */
export const EMERGENCY_FIELD = "emergency";

/** An outside contact's field name in issues: `outside.<id>.<field>`. */
export const outsideFieldName = (id: string, field: "name" | "relationship" | "phone") =>
  `outside.${id}.${field}`;

/** The posted draft, or null when it isn't one. */
export const parseEmergencySave = (text: unknown): EmergencySave | null => {
  if (typeof text !== "string") return null;
  try {
    const value = JSON.parse(text) as Partial<EmergencySave>;
    if (!Array.isArray(value.outside) || !Array.isArray(value.order)) return null;
    const primary = typeof value.primaryUserId === "string" ? value.primaryUserId : null;
    return { outside: value.outside, order: value.order, primaryUserId: primary };
  } catch {
    return null;
  }
};

/**
 * Whether the device has the saved list (after an online save): the same
 * order, the same outside contacts, the same primary contact.
 */
export const emergencyMatches = (
  members: readonly EmergencyMemberRow[],
  outside: readonly OutsideContact[],
  saved: EmergencySave,
) => {
  const order = emergencyEntries(members, outside).map((e) => e.key);
  const want = saved.order.map(emergencyRefKey);
  const primary = members.find((m) => !!m.is_primary_contact)?.user_id ?? null;
  const outsideKey = (cs: readonly { id: string; name: string; phone: string }[]) =>
    JSON.stringify(cs.map((c) => [c.id, c.name.trim(), c.phone.trim()]).sort());
  return (
    JSON.stringify(order) === JSON.stringify(want) &&
    primary === saved.primaryUserId &&
    outsideKey(outside) === outsideKey(saved.outside)
  );
};
