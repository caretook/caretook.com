import type { ProviderStatus, ProviderType } from "@caretook/data/schema";

import { compareProviders, matchesQuery, PROVIDER_TYPE_META, queryTokens } from "./providerDirectory";

// The `@` popup's choices in a live document, pure: what's offered for the
// text typed after the `@`. The same matching and order as the With
// picker's (`providerDirectory`), but linked providers stay in, since a
// mention is also text. Writers also get a last row that adds the typed
// name as a provider. No React or database; web:unit tests it.

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

/** The popup's last row for writers: add the typed name as a new provider (a clinician). */
export type MentionAdd = { kind: "add"; name: string; label: string };

/** A row of the popup: one of the group's providers, or the add row. */
export type MentionChoice = ({ kind: "provider" } & MentionOption) | MentionAdd;

/** What the add row says. */
export const addProviderLabel = (name: string) => `Add "${name}" as a provider`;

/** A name, compared: case, accents and spacing ignored. */
const sameName = (name: string) => queryTokens(name).join(" ");

/**
 * The add row for `query`, or null: there's text, and no live provider in
 * the group has exactly that name (case, accents and spacing ignored), so
 * "Dr. Chen" is offered beside "Dr. Chen-Li" but not beside "dr. chen".
 */
export const mentionAddRow = (providers: readonly MentionProvider[], query: string): MentionAdd | null => {
  const name = query.trim().replace(/\s+/g, " ");
  const folded = sameName(name);
  if (!folded) return null;
  if (providers.some((p) => !p.deletedAt && sameName(p.name) === folded)) return null;
  return { kind: "add", name, label: addProviderLabel(name) };
};

/**
 * Every row of the popup, in order: the matching providers
 * (`mentionOptions`), then, for writers (`canAdd`), the add row. The add row
 * is always the separate, final part.
 */
export const mentionChoices = (
  providers: readonly MentionProvider[],
  query: string,
  { canAdd, limit = MENTION_LIMIT }: { canAdd: boolean; limit?: number },
): MentionChoice[] => {
  const matches: MentionChoice[] = mentionOptions(providers, query, limit).map((o) => ({
    kind: "provider",
    ...o,
  }));
  const add = canAdd ? mentionAddRow(providers, query) : null;
  return add ? [...matches, add] : matches;
};

/**
 * Whether the popup stays open for `query` (what's typed after the `@`,
 * spaces allowed so a new name like "Rosa Lind" can be typed whole). It
 * closes on a leading space, and once a third word starts while the words
 * before it match no provider: "@Mom said to" is text, not a search, while
 * "@Dr. Elena Al" still finds Dr. Elena Alvarez.
 */
export const mentionQueryOpen = (providers: readonly MentionProvider[], query: string) => {
  if (/^\s/.test(query)) return false;
  const lastSpace = query.search(/\s\S*$/);
  if (lastSpace < 0) return true;
  const before = query.slice(0, lastSpace);
  return queryTokens(before).length < 2 || mentionOptions(providers, before, 1).length > 0;
};
