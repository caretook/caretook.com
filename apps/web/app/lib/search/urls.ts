import type { SearchItemType } from "@caretook/data/schema";

import { SEARCH_ITEM_TYPES } from "@caretook/data/schema";
import { groupHome, searchString } from "../core/urls";

/** The search page's text (`?q=`), and the one section it shows in full (`?all=provider`). */
export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_ALL_PARAM = "all";
/** The search page's care period (`?period=<id>`): only matches within its dates. Only with a search. */
export const SEARCH_PERIOD_PARAM = "period";
export const isSearchItemType = (value: unknown): value is SearchItemType =>
  (SEARCH_ITEM_TYPES as readonly unknown[]).includes(value);

export const searchUrls = {
  /**
   * A group's search page, with what's searched for (`?q=`, untrimmed: it's
   * the field's text) and the section shown in full (`?all=`; an unknown
   * type, or one without a search, is dropped), and the care period the
   * search is narrowed to (`?period=`; dropped without a search).
   */
  search: (
    groupId: string,
    q?: string | null,
    { all, period }: { all?: SearchItemType | null; period?: string | null } = {},
  ) =>
    `${groupHome(groupId)}/search${searchString({
      [SEARCH_QUERY_PARAM]: q,
      [SEARCH_ALL_PARAM]: q?.trim() && isSearchItemType(all) ? all : null,
      [SEARCH_PERIOD_PARAM]: q?.trim() ? period : null,
    })}`,
} as const;
