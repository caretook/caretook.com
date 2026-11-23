import { z } from "zod";

// The avatar catalog (client-safe, pure): the fixed colors and icons a member
// can choose from. Stored values are these ids, never free text or URLs. A new
// id needs an additive migration (the `user` checks list them), and an id must
// stay valid once stored.

export const AVATAR_COLORS = [
  "coral",
  "ochre",
  "moss",
  "fern",
  "jade",
  "sky",
  "blue",
  "violet",
  "orchid",
  "rose",
] as const;

export const AVATAR_ICONS = [
  "flower",
  "leaf",
  "tree",
  "sun",
  "moon",
  "star",
  "cloud",
  "mountain",
  "bird",
  "cat",
  "dog",
  "fish",
  "coffee",
  "music",
  "anchor",
  "feather",
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number];
export type AvatarIcon = (typeof AVATAR_ICONS)[number];
/** A member's choice; null is the default. */
export type AvatarChoice = { color: AvatarColor | null; icon: AvatarIcon | null };

export const NO_AVATAR_CHOICE: AvatarChoice = { color: null, icon: null };

/** A whole choice: both fields are sent, and null clears one. */
export const avatarChoiceZSchema = z.strictObject({
  color: z.enum(AVATAR_COLORS).nullable(),
  icon: z.enum(AVATAR_ICONS).nullable(),
});

const isIn = <T extends string>(ids: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (ids as readonly string[]).includes(value);

/** A stored color id, or null for an unknown one: an older device survives a newer id. */
export const readAvatarColor = (value: unknown): AvatarColor | null =>
  isIn(AVATAR_COLORS, value) ? value : null;

/** A stored icon id, or null for an unknown one. */
export const readAvatarIcon = (value: unknown): AvatarIcon | null =>
  isIn(AVATAR_ICONS, value) ? value : null;

/** A stored choice, with anything unknown read as unset. */
export const readAvatarChoice = (value: unknown): AvatarChoice => {
  if (typeof value !== "object" || value === null) return NO_AVATAR_CHOICE;
  const { color, icon } = value as { color?: unknown; icon?: unknown };
  return { color: readAvatarColor(color), icon: readAvatarIcon(icon) };
};
