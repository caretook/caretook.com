import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { compareProviders, matchesQuery, PROVIDER_TYPE_META, queryTokens } from "./providerDirectory";

// The `@` popup's choices in a live document, pure: what's offered for the
// text typed after the `@`. The same matching and order as the With
// picker's (`providerDirectory`), but linked providers stay in, since a
// mention is also text. No React or database; web:unit tests it.

export type MentionProvider = {
  id: string;
  type: ProviderType;
  name: string;
  specialty: string | null;
  practiceId: string | null;
  status: ProviderStatus;
  isPrimary: boolean;
  deletedAt: string | null;
};

export type MentionOption = { id: string; label: string; description: string };

/** How many choices the popup lists at most. */
export const MENTION_LIMIT = 20;

/**
 * The popup's choices for `query`: the group's providers that aren't
 * deleted, matching every typed word in the name, specialty or practice
 * name (case and accents ignored), in display order (primary, current, then
 * past), up to `limit`. Each says what it is: "Cardiology", "Pharmacy · Past".
 */
export const mentionOptions = (
  providers: readonly MentionProvider[],
  query: string,
  limit = MENTION_LIMIT,
): MentionOption[] => {
  const names = new Map(providers.map((p) => [p.id, p.name]));
  const tokens = queryTokens(query);
  return providers
    .filter((p) => !p.deletedAt)
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
