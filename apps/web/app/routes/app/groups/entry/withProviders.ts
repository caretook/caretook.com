import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import {
  compareProviders,
  matchesQuery,
  PROVIDER_TYPE_META,
  queryTokens,
} from "../../../../lib/providers/providerDirectory";

// The entry page's With row, its pure parts: what the picker offers for the
// typed text, and what each linked provider's chip says. No React or
// database; unit-tested in web:unit (so imports stay relative).

export type PickerProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

export type PickerOption = { id: string; label: string; description: string };

/** How many choices the picker lists at most. */
export const PICKER_LIMIT = 20;

/**
 * The picker's choices for `text`: the group's providers that aren't deleted
 * or linked already, matching every typed word in the name, specialty or
 * practice name, in display order (primary, current, then past). Each says
 * what it is: "Cardiology · Westside Family Medicine", "Pharmacy", "Past".
 */
export const pickerOptions = (
  providers: readonly PickerProvider[],
  linked: ReadonlySet<string>,
  text: string,
  limit = PICKER_LIMIT,
): PickerOption[] => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(text);
  return providers
    .filter((p) => !p.deletedAt && !linked.has(p.id))
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
 * Whether to offer "Add "<text>" as a provider": there's text, and no
 * provider in the group (linked or not, not deleted) already has that name.
 */
export const canAddNamed = (providers: readonly PickerProvider[], text: string) => {
  const name = text.trim().toLocaleLowerCase();
  if (!name) return false;
  return !providers.some((p) => !p.deletedAt && p.name.trim().toLocaleLowerCase() === name);
};
