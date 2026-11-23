import type { AvatarColor, AvatarIcon } from "@caretook/data/schema";

import { AVATAR_COLORS, readAvatarColor, readAvatarIcon } from "@caretook/data/schema";

// Who looks like what in one care group (pure): the only place that knows how
// a default color is assigned. Nothing here is stored, so every device works
// out the same answer offline.
//
// Chosen colors are reserved. Then the members without one, in join order
// (`created_at`, then membership id), each take the color their membership id
// hashes to, or the next free one. With no free color left (past ten members)
// a member falls back to their hashed color, so colors repeat.

export type LookMember = {
  userId: string;
  membershipId: string;
  /** When they joined; null until the row's column has synced (sorted last). */
  joinedAt: string | null;
  color: string | null;
  icon: string | null;
};

export type MemberLook = {
  /** Their chosen color; null when they haven't chosen one (or it's an id this version doesn't know). */
  color: AvatarColor | null;
  icon: AvatarIcon | null;
  /** Their color in this group when they haven't chosen one. */
  defaultColor: AvatarColor;
};

/** FNV-1a: small and stable, the same on every device. */
const hash = (text: string) => {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
};

/** Plain code-unit order: `localeCompare` could differ between devices. */
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const byJoinOrder = (a: LookMember, b: LookMember) => {
  if (a.joinedAt !== b.joinedAt) {
    if (a.joinedAt === null) return 1;
    if (b.joinedAt === null) return -1;
    return compareText(a.joinedAt, b.joinedAt);
  }
  return compareText(a.membershipId, b.membershipId);
};

const hashedIndex = (membershipId: string) => hash(membershipId) % AVATAR_COLORS.length;

/** The hashed color if it's free, else the next free one, else (none free) the hashed color. */
const pickDefault = (membershipId: string, taken: ReadonlySet<AvatarColor>): AvatarColor => {
  const start = hashedIndex(membershipId);
  for (let step = 0; step < AVATAR_COLORS.length; step++) {
    const color = AVATAR_COLORS[(start + step) % AVATAR_COLORS.length]!;
    if (!taken.has(color)) return color;
  }
  return AVATAR_COLORS[start]!;
};

/** Each member's look in this group, by user id. The order of `members` doesn't matter. */
export const resolveMemberLooks = (members: readonly LookMember[]): Map<string, MemberLook> => {
  const taken = new Set<AvatarColor>();
  for (const member of members) {
    const color = readAvatarColor(member.color);
    if (color) taken.add(color);
  }
  const looks = new Map<string, MemberLook>();
  for (const member of [...members].sort(byJoinOrder)) {
    const color = readAvatarColor(member.color);
    const defaultColor = color ?? pickDefault(member.membershipId, taken);
    taken.add(defaultColor);
    looks.set(member.userId, { color, icon: readAvatarIcon(member.icon), defaultColor });
  }
  return looks;
};
