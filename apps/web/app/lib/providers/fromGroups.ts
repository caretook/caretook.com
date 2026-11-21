import type { ImportSource, ImportTarget } from "./providerImport";

import { fromGroupHeading } from "./importWording";
import { alreadyHereIds } from "./providerImport";
import { compareProviders, matchesQuery, PROVIDER_TYPE_META, queryTokens } from "./providerDirectory";

// The pickers' "From <group>" sections (the With picker and the `@` popup):
// the user's other groups' providers that match what's typed, so one typed
// in another group can be copied here and used in one pick. Pure; web:unit
// tests it.
//
// - Nothing until something is typed (the empty picker stays this group's).
// - Matches only, as this group's options match (every word in the name,
//   specialty or practice name; case and accents ignored), in display order.
// - Minus ones already here: the same type and folded name as a live
//   provider in this group (the importer's duplicate rule).
// - Up to `FROM_GROUP_LIMIT` per group; a group with none has no section.

/** Another group the user belongs to, with its providers as the device holds them. */
export type OtherGroupProviders = { id: string; name: string; providers: readonly ImportSource[] };

/** A provider in another group, offered for copying here. */
export type FromGroupOption = { groupId: string; sourceId: string; label: string; description: string };

/** One group's section: its heading ("From Lou Lindqvist") and its matches. */
export type FromGroupSection = { groupId: string; heading: string; options: FromGroupOption[] };

/** How many of one group's providers a section lists at most. */
export const FROM_GROUP_LIMIT = 5;

/** What a provider is, for an option's second line: "Cardiology · Westside Family Medicine", "Pharmacy · Past". */
export const providerDescription = (
  p: Pick<ImportSource, "type" | "specialty" | "status">,
  practiceName: string | null | undefined,
) => {
  const what = p.specialty || PROVIDER_TYPE_META[p.type].label;
  return [what, practiceName, p.status === "past" ? "Past" : null].filter(Boolean).join(" · ");
};

/**
 * The sections for `query`, in the order the groups are given: each other
 * group's live providers that match, minus ones already here (`here`, this
 * group's providers), up to `limit` each. None while nothing is typed.
 */
export const fromGroupSections = (
  groups: readonly OtherGroupProviders[],
  here: readonly ImportTarget[],
  query: string,
  limit = FROM_GROUP_LIMIT,
): FromGroupSection[] => {
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  return groups
    .map((group) => {
      const names = new Map(group.providers.map((p) => [p.id, p.name]));
      const already = alreadyHereIds(group.providers, here);
      const options = group.providers
        .filter((p) => !p.deletedAt && !already.has(p.id))
        .filter((p) => matchesQuery(p, tokens, p.practiceId ? names.get(p.practiceId) : null))
        .sort(compareProviders)
        .slice(0, limit)
        .map((p) => ({
          groupId: group.id,
          sourceId: p.id,
          label: p.name,
          description: providerDescription(p, p.practiceId ? names.get(p.practiceId) : null),
        }));
      return { groupId: group.id, heading: fromGroupHeading(group.name), options };
    })
    .filter((s) => s.options.length > 0);
};

/** The section option with this source id, or undefined (a pick that's one of this group's). */
export const fromGroupOption = (sections: readonly FromGroupSection[], sourceId: string) =>
  sections.flatMap((s) => s.options).find((o) => o.sourceId === sourceId);
