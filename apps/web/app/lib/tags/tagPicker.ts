import { TAG_NAME_MAX, tagKey, tagName } from "@caretook/data/schema";

// The picker sheet's matching and the chips' split (tags PRD), pure. Names
// fold through the rules module's `tagKey` only: nothing here folds a name
// another way.

type Named = { name_key: string };

/** The tags the filter box keeps: every one while it's empty, else those whose key holds the typed text's. */
export const matchingTags = <T extends Named>(tags: readonly T[], typed: string): T[] => {
  const key = tagKey(typed);
  return key ? tags.filter((t) => t.name_key.includes(key)) : [...tags];
};

/** The tag the typed text names exactly, in any case or spacing (reused, never added again). */
export const exactTag = <T extends Named>(tags: readonly T[], typed: string): T | undefined => {
  const key = tagKey(typed);
  return key ? tags.find((t) => t.name_key === key) : undefined;
};

/**
 * The new name the picker offers to add: the typed text, tidied, when it's a
 * valid name and the group has no tag by that key. Null otherwise (nothing
 * typed, too long, or an existing tag, which the list shows instead).
 */
export const newTagName = (tags: readonly Named[], typed: string): string | null => {
  const name = tagName(typed);
  if (!name || name.length > TAG_NAME_MAX || exactTag(tags, name)) return null;
  return name;
};

/** How many chips a row shows before "+N". */
export const ROW_CHIPS = 2;

/** A row's chips: the first `max`, and how many more ("+N"; 0 for none). */
export const chipSplit = <T>(tags: readonly T[], max = ROW_CHIPS) => ({
  shown: tags.slice(0, max),
  more: Math.max(0, tags.length - max),
});

/**
 * A search result's chips in order: the tags its text names (`named`, their
 * ids) first, then the rest, each part A to Z by key, so a row's first two
 * chips show why it matched.
 */
export const namedFirst = <T extends Named & { id: string }>(
  tags: readonly T[],
  named: readonly string[],
): T[] => {
  const ids = new Set(named);
  const az = [...tags].sort((a, b) => (a.name_key < b.name_key ? -1 : a.name_key > b.name_key ? 1 : 0));
  return [...az.filter((t) => ids.has(t.id)), ...az.filter((t) => !ids.has(t.id))];
};
