import type { SearchItemType } from "@caretook/data/schema";

import { SEARCH_ITEM_TYPES, TAG_PARAM } from "@caretook/data/schema";
import { groupHome, searchString } from "../core/urls";

/** The search page's text (`?q=`), and the one section it shows in full (`?all=provider`). */
export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_ALL_PARAM = "all";
/** The search page's care period (`?period=<id>`): only matches within its dates. Only with a search. */
export const SEARCH_PERIOD_PARAM = "period";
/** The search page's tag (`?tag=<id>`, tagRules' `TAG_PARAM`): only items carrying it; with no text, every one of them. */
export const SEARCH_TAG_PARAM = TAG_PARAM;
export const isSearchItemType = (value: unknown): value is SearchItemType =>
  (SEARCH_ITEM_TYPES as readonly unknown[]).includes(value);

export const searchUrls = {
  /**
   * A group's search page, with what's searched for (`?q=`, untrimmed: it's
   * the field's text) and the section shown in full (`?all=`; an unknown
   * type, or one with neither a search nor a tag, is dropped), the care period the
   * search is narrowed to (`?period=`; dropped without a search), and the tag (`?tag=`).
   */
  search: (
    groupId: string,
    q?: string | null,
    { all, period, tag }: { all?: SearchItemType | null; period?: string | null; tag?: string | null } = {},
  ) =>
    `${groupHome(groupId)}/search${searchString({
      [SEARCH_QUERY_PARAM]: q,
      [SEARCH_ALL_PARAM]: (q?.trim() || tag) && isSearchItemType(all) ? all : null,
      [SEARCH_PERIOD_PARAM]: q?.trim() ? period : null,
      [SEARCH_TAG_PARAM]: tag,
    })}`,
} as const;
