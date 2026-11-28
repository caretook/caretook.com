import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { REMOVED_PROVIDER } from "./entryProviders";
import { compareProviders, fold, matchesQuery, PROVIDER_TYPE_META, queryTokens } from "./providerDirectory";

// The provider pickers' pure parts (the medication form's prescriber and
// pharmacy, a condition's diagnosed by and managed by): which of the group's
// providers a picker offers for the typed text, and when to offer adding the
// typed name as a new one. No React or database; web:unit tests it through
// the medication form's `medicationProviders` and the conditions' own test.

export type PickableProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

/** How many choices a picker lists at most. */
export const PICKER_LIMIT = 20;

/** Which providers a picker offers, by type. */
export type ProviderFit = (type: string) => boolean;

/**
 * The picker's choices for `text`: the group's providers that fit and
 * aren't deleted (nor in `exclude`, already chosen), matching every typed
 * word (name, specialty or practice), in display order. Each says what it
 * is: "Cardiology · Westside Family Medicine", "Practice", "Past". A deleted
 * practice is neither named nor matched.
 */
export const pickerOptions = (
  providers: readonly PickableProvider[],
  fits: ProviderFit,
  text: string,
  { limit = PICKER_LIMIT, exclude = [] }: { limit?: number; exclude?: readonly string[] } = {},
) => {
  const names = new Map(providers.filter((p) => !p.deletedAt).map((p) => [p.id, p.name]));
  const tokens = queryTokens(text);
  return providers
    .filter((p) => !p.deletedAt && fits(p.type) && !exclude.includes(p.id))
    .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
    .sort(compareProviders)
    .slice(0, limit)
    .map((p) => {
      const practice = p.practiceId ? names.get(p.practiceId) : null;
      const what = p.specialty || PROVIDER_TYPE_META[p.type].label;
      const parts = [what, practice, p.status === "past" ? "Past" : null].filter(Boolean);
      return { id: p.id, label: p.name, description: parts.join(" · ") };
    });
};

/**
 * Whether to offer adding the typed name as a new provider: there's text,
 * and no live provider that fits has that name already (case and accents
 * ignored), nor one of `pending` (names already chosen to add).
 */
export const canAddPicked = (
  providers: readonly PickableProvider[],
  fits: ProviderFit,
  text: string,
  pending: readonly string[] = [],
) => {
  const name = fold(text.trim());
  if (!name) return false;
  if (pending.some((p) => fold(p.trim()) === name)) return false;
  return !providers.some((p) => !p.deletedAt && fits(p.type) && fold(p.name.trim()) === name);
};

/** What a chosen provider's chip says: its name, "Removed provider" once deleted, "(new)" before it's saved. */
export const chosenLabel = (name: string, { deleted = false, isNew = false } = {}) =>
  isNew ? `${name} (new)` : deleted ? REMOVED_PROVIDER : name;

/** Who can diagnose or manage a condition: anyone but a pharmacy. */
export const fitsCondition: ProviderFit = (type) => type !== "pharmacy";
