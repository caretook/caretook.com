import type { FilterSection } from "../../components/ui/filterModel";

import { activeTag, tagFromParams, withTagParam } from "@caretook/data/schema";

// A list's "Tag" filter (tags PRD), pure (web:unit tests it): `?tag=<id>`
// read against the group's tags (an unknown or deleted one is no filter)
// and the Filter menu's section for it, shown only when the group has tags.

/** The section's "no filter" choice. */
export const ANY_TAG = "any";

type Named = { id: string; name: string };

/** The tag `search` filters by, if it's one of the group's `tags`; else null. */
export const tagFilterOf = <T extends Named>(search: string, tags: readonly T[]) =>
  activeTag(tagFromParams(new URLSearchParams(search)), tags);

/** `search` with the tag filter set to `tagId`, or without it (null): "" or "?…", the rest kept. */
export const setTagFilter = (search: string, tagId: string | null) => {
  const rest = withTagParam(new URLSearchParams(search), tagId).toString();
  return rest ? `?${rest}` : "";
};

/**
 * The Filter menu's "Tag" section: Any (the default: no `?tag=`, no count,
 * no chip), then each of the group's tags A to Z (as `tags` come). Null
 * when the group has no tags, so the menu has no empty section.
 */
export const tagFilterSection = (search: string, tags: readonly Named[]): FilterSection | null => {
  if (!tags.length) return null;
  return {
    id: "tag",
    title: "Tag",
    current: tagFilterOf(search, tags)?.id ?? ANY_TAG,
    defaultId: ANY_TAG,
    options: [
      { id: ANY_TAG, label: "Any", search: setTagFilter(search, null) },
      ...tags.map((t) => ({ id: t.id, label: t.name, search: setTagFilter(search, t.id) })),
    ],
  };
};
