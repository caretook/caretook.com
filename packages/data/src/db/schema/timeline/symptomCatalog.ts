import { uuidV5 } from "../core/uuidV5";

// The symptom catalog's rules (symptom-catalog PRD), pure and client-safe:
// the one place a symptom name is folded. The device, the server and the
// backfill all call these, so a name typed offline on two devices, or found
// in an old entry, lands on the same catalog row (`symptom_type`).

/** The namespace for catalog ids (a fixed, random UUID; never change it). */
export const SYMPTOM_TYPE_NAMESPACE = "b4e7c2d9-6a13-4f58-9c0e-2d8a5f1b7e36";

/**
 * The longest name: a symptom entry's (`TIMELINE_LIMITS.symptomName`, kept
 * equal by a test; not imported, so timelineEntry.ts can import this area).
 */
export const SYMPTOM_NAME_MAX = 120;

/** A name as stored and shown: trimmed, with runs of spaces made one. */
export const symptomName = (name: string) => name.trim().replace(/\s+/g, " ");

/**
 * What makes two names one symptom: case and spaces only. "knee pain" and
 * "Knee  Pain" are one type; "knee ache" stays its own.
 */
export const symptomKey = (name: string) => symptomName(name).toLocaleLowerCase("en-US");

/**
 * A catalog row's id: the version 5 UUID of its group and key, so two
 * devices adding "Nausea" offline write one row. Case-insensitive in the group id.
 */
export const symptomTypeId = (groupId: string, name: string) =>
  uuidV5(`${groupId.toLowerCase()}:${symptomKey(name)}`, SYMPTOM_TYPE_NAMESPACE);

/**
 * Every group's starting catalog: common caretaking symptoms, in everyday
 * words. Copied into each group when it's made, and into older groups by the
 * backfill (`symptomTypeService.backfill`), which adds any new name here too.
 */
export const DEFAULT_SYMPTOMS = [
  "Pain",
  "Headache",
  "Nausea",
  "Vomiting",
  "Dizziness",
  "Fatigue",
  "Shortness of breath",
  "Cough",
  "Fever",
  "Chills",
  "Constipation",
  "Diarrhea",
  "Loss of appetite",
  "Trouble sleeping",
  "Confusion",
  "Anxiety",
  "Low mood",
  "Agitation",
  "Swelling",
  "Rash",
  "Itching",
  "Numbness or tingling",
  "Fall",
] as const;

// ---------------------------------------------------------------------------
// Similar names: the check before a new name joins the catalog (slice 3).
// ---------------------------------------------------------------------------

/** At most this many similar names are offered. */
export const SIMILAR_SYMPTOMS_MAX = 3;

/** A key's words: letters and digits, so "Knee-pain" and "knee pain" share them. */
const wordsOf = (key: string) => key.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Levenshtein distance, stopping early once it's past `max` (returns `max + 1`). */
const editDistance = (a: string, b: string, max: number) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const d = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      row.push(d);
      best = Math.min(best, d);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length]!;
};

/** The typo distance allowed between two keys: none under 4 letters, 1 up to 7, then 2. */
const typoAllowance = (a: string, b: string) => {
  const shorter = Math.min(a.length, b.length);
  return shorter < 4 ? 0 : shorter < 8 ? 1 : 2;
};

/**
 * How close `name` is to a catalog name, lower is closer: 0 the same words
 * in another order, 1 a small typo, 2 the shorter name's words (two or
 * more) all inside the other's; null when they aren't similar (or are the
 * same key).
 */
const similarity = (key: string, words: string[], other: string): number | null => {
  if (other === key) return null;
  const otherWords = wordsOf(other);
  const mine = new Set(words);
  const theirs = new Set(otherWords);
  const same = mine.size === theirs.size && [...mine].every((w) => theirs.has(w));
  if (same && mine.size > 0) return 0;
  const allowed = typoAllowance(key, other);
  if (allowed > 0 && editDistance(key, other, allowed) <= allowed) return 1;
  const [small, big] = mine.size <= theirs.size ? [mine, theirs] : [theirs, mine];
  // Two words at least: one word inside a longer name is too loose ("Pain"
  // isn't "Knee pain").
  if (small.size >= 2 && [...small].every((w) => big.has(w))) return 2;
  return null;
};

/**
 * `name` against a group's catalog: the row with the same key (`exact`, to
 * reuse), else up to three similar ones (`similar`, closest first, then A
 * to Z): the same words in any order, a small typo, or one name's words (two
 * or more) all inside the other's. Pure, so it runs on the device's local copy offline.
 */
export const similarSymptoms = <T extends { name: string }>(
  name: string,
  catalog: readonly T[],
): { exact: T | null; similar: T[] } => {
  const key = symptomKey(name);
  if (!key) return { exact: null, similar: [] };
  const exact = catalog.find((row) => symptomKey(row.name) === key) ?? null;
  if (exact) return { exact, similar: [] };
  const words = wordsOf(key);
  const similar = catalog
    .map((row) => ({ row, key: symptomKey(row.name), rank: similarity(key, words, symptomKey(row.name)) }))
    .filter((c): c is { row: T; key: string; rank: number } => c.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key, "en-US"))
    .slice(0, SIMILAR_SYMPTOMS_MAX)
    .map((c) => c.row);
  return { exact: null, similar };
};
