import type { SimpleTile, SimpleTiles, VitalType } from "@caretook/data/schema";

import { SIMPLE_TILE_COUNT, simpleTilesZSchema, VITAL_TYPES, VITALS } from "@caretook/data/schema";

// Simple mode's four tiles (assistant PRD): which four a group shows, and
// what they say. Pure, so web:unit tests it.
//
// - A group's choice is `care_group.simple_tiles`: learned from use (null,
//   the default), the fixed set, or four an owner or admin picked.
// - Learned: the four most-logged of note, symptom, dose and each vital type
//   over the group's last 30 days, padded with the fixed set.
// - Labels use the recipient's pronouns when the profile has ones we know
//   ("How she feels"), else their name ("How Grandma June feels").

/** The fixed set, and what pads a learned set. */
export const FIXED_TILES: readonly SimpleTile[] = [
  { kind: "symptom" },
  { kind: "vital", vitalType: "bloodPressure" },
  { kind: "dose" },
  { kind: "note" },
];

/** How far back learned tiles look. */
export const LEARNED_DAYS = 30;
const DAY_MS = 86_400_000;

/** A tile as one string, for keys, form values and comparing: `symptom`, `vital:heartRate`. */
export const tileKey = (tile: SimpleTile) => (tile.kind === "vital" ? `vital:${tile.vitalType}` : tile.kind);

/** `tileKey` read back; null for anything that isn't a tile. */
export const tileFromKey = (key: string): SimpleTile | null => {
  if (key === "note" || key === "symptom" || key === "dose") return { kind: key };
  const [kind, type] = key.split(":");
  if (kind === "vital" && (VITAL_TYPES as readonly string[]).includes(type ?? ""))
    return { kind: "vital", vitalType: type as VitalType };
  return null;
};

/** Every tile an owner can pick, in the order the picker lists them. */
export const TILE_CHOICES: readonly SimpleTile[] = [
  { kind: "symptom" },
  { kind: "dose" },
  { kind: "note" },
  ...VITAL_TYPES.map((vitalType) => ({ kind: "vital" as const, vitalType })),
];

/** One entry as learning needs it: its kind, and a vital's reading types. */
export type LearnedEntry = { kind: string; occurredAt: string; vitalTypes?: readonly string[] };

/**
 * The four most-logged tiles over the last 30 days (a vitals entry counts
 * once for each of its types), most first; ties go to the fixed set's order,
 * then the vital types' order. Fewer than four are padded with the fixed set.
 */
export const learnedTiles = (entries: readonly LearnedEntry[], now: Date): SimpleTile[] => {
  const since = now.getTime() - LEARNED_DAYS * DAY_MS;
  const counts = new Map<string, number>();
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const entry of entries) {
    const at = new Date(entry.occurredAt).getTime();
    if (!(at >= since && at <= now.getTime())) continue;
    if (entry.kind === "note" || entry.kind === "symptom" || entry.kind === "dose") add(entry.kind);
    else if (entry.kind === "vital")
      for (const type of new Set(entry.vitalTypes ?? []))
        if ((VITAL_TYPES as readonly string[]).includes(type)) add(`vital:${type}`);
  }
  const order = [...FIXED_TILES, ...TILE_CHOICES].map(tileKey);
  const rank = (key: string) => order.indexOf(key);
  const top = [...counts.entries()]
    .sort(([a, x], [b, y]) => y - x || rank(a) - rank(b))
    .slice(0, SIMPLE_TILE_COUNT)
    .map(([key]) => key);
  for (const tile of FIXED_TILES) {
    if (top.length >= SIMPLE_TILE_COUNT) break;
    if (!top.includes(tileKey(tile))) top.push(tileKey(tile));
  }
  return top.map((key) => tileFromKey(key)!);
};

/** The group's stored choice (JSON text from the device), or null (learned) when missing or unreadable. */
export const parseSimpleTiles = (json: string | null | undefined): SimpleTiles | null => {
  if (!json) return null;
  try {
    const parsed = simpleTilesZSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The four tiles a group shows now. */
export const groupTiles = (
  setting: SimpleTiles | null,
  entries: readonly LearnedEntry[],
  now: Date,
): SimpleTile[] => {
  if (setting?.mode === "custom") return [...setting.tiles];
  if (setting?.mode === "fixed") return [...FIXED_TILES];
  return learnedTiles(entries, now);
};

/** How labels talk about the recipient: pronouns we know, else their name. */
export type RecipientWords =
  | { pronoun: "she" | "he" | "they"; possessive: string; name?: never }
  | { name: string; pronoun?: never; possessive?: never };

const PRONOUNS = {
  she: { pronoun: "she", possessive: "her" },
  he: { pronoun: "he", possessive: "his" },
  they: { pronoun: "they", possessive: "their" },
} as const;

const PRONOUN_SET: Record<string, keyof typeof PRONOUNS> = {
  she: "she",
  her: "she",
  hers: "she",
  he: "he",
  him: "he",
  his: "he",
  they: "they",
  them: "they",
  their: "they",
  theirs: "they",
};

/**
 * The words for the recipient from their profile's pronouns ("she/her",
 * "He", "they/them"): only she, he and they are used, so anything else
 * (two sets, neopronouns, a note) falls back to their name, which is never wrong.
 */
export const recipientWords = (displayName: string, pronouns: string | null | undefined): RecipientWords => {
  const words = (pronouns ?? "")
    .toLowerCase()
    .split(/[\s/,]+/)
    .filter(Boolean);
  const sets = new Set(words.map((word) => PRONOUN_SET[word] ?? "other"));
  const [only] = sets;
  if (sets.size === 1 && only && only !== "other") return { ...PRONOUNS[only] };
  return { name: displayName.trim() || "them" };
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "How she feels", "How they feel", "How Grandma June feels". */
export const feelLabel = (words: RecipientWords) =>
  words.name !== undefined
    ? `How ${words.name} feels`
    : `How ${words.pronoun} ${words.pronoun === "they" ? "feel" : "feels"}`;

/** "Her medicines", "Grandma June's medicines". */
export const medicinesLabel = (words: RecipientWords) =>
  words.name !== undefined ? `${words.name}'s medicines` : `${capitalise(words.possessive)} medicines`;

/** "A note about her day", "A note about Grandma June's day". */
export const noteLabel = (words: RecipientWords) =>
  `A note about ${words.name !== undefined ? `${words.name}'s` : words.possessive} day`;

/** A tile's words, in plain language about the recipient. A vital is its type's name ("Blood sugar"). */
export const tileLabel = (tile: SimpleTile, words: RecipientWords): string => {
  if (tile.kind === "vital") return VITALS[tile.vitalType].label;
  if (tile.kind === "symptom") return feelLabel(words);
  if (tile.kind === "dose") return medicinesLabel(words);
  return noteLabel(words);
};

/** The name a symptom saved from the feelings scale gets when nothing more is typed. */
export const FEELING_SYMPTOM_NAME = "Feeling";
