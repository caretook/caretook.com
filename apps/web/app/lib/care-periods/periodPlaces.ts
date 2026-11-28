import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import {
  compareProviders,
  fold,
  matchesQuery,
  PROVIDER_TYPE_META,
  queryTokens,
} from "../providers/providerDirectory";

// The care period form's place picker, its pure parts: which of the group's
// providers it offers for the typed text (practices first: hospitals and
// facilities are practices in the directory), and when to offer adding the
// typed name as a new place. No React or database; web:unit tests it (so
// imports stay relative). Like the medication form's `medicationProviders`.

export type PlaceProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

/** How many choices the picker lists at most. */
export const PLACE_PICKER_LIMIT = 20;

const practicesFirst = (a: PlaceProvider, b: PlaceProvider) =>
  Number(a.type !== "practice") - Number(b.type !== "practice") || compareProviders(a, b);

/**
 * The picker's choices for `text`: the group's live providers of any type,
 * matching every typed word (name, specialty or practice), practices first,
 * then the rest in display order. Each says what it is ("Hospital", "Practice").
 */
export const placeOptions = (
  providers: readonly PlaceProvider[],
  text: string,
  limit = PLACE_PICKER_LIMIT,
) => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(text);
  return providers
    .filter((p) => !p.deletedAt)
    .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
    .sort(practicesFirst)
    .slice(0, limit)
    .map((p) => {
      const practice = p.practiceId ? names.get(p.practiceId) : null;
      const what = p.specialty || PROVIDER_TYPE_META[p.type].label;
      const parts = [what, practice, p.status === "past" ? "Past" : null].filter(Boolean);
      return { id: p.id, label: p.name, description: parts.join(" · ") };
    });
};

/** Whether to offer adding the typed name as a new place: there's text, and no live provider has that name. */
export const canAddPlace = (providers: readonly PlaceProvider[], text: string) => {
  const name = fold(text.trim());
  if (!name) return false;
  return !providers.some((p) => !p.deletedAt && fold(p.name.trim()) === name);
};

/** What the chosen place's chip says: its name, "(removed)" once deleted, "(new)" before it's saved. */
export const placeChipLabel = (name: string, { deleted = false, isNew = false } = {}) =>
  isNew ? `${name} (new)` : deleted ? `${name} (removed)` : name;
