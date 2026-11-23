import type { ProviderType } from "@caretook/data/schema";
import type { Search } from "../core/urls";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { groupHome, searchString, segment } from "../core/urls";

/** A new provider's type (`providers/new?type=pharmacy`), the same parameter as the directory's type filter. */
export const PROVIDER_TYPE_PARAM = "type";

export const providerUrls = {
  /** A group's provider directory, with its search and filters (`?q=`, `?type=`) carried through. */
  providers: (groupId: string, search?: Search) => `${groupHome(groupId)}/providers${searchString(search)}`,
  /**
   * The add sheet over the directory, carrying the list's search and filters.
   * `type` starts the form as that type (it's also the list's type filter, so
   * it replaces one already there); an unknown type is dropped.
   */
  newProvider: (groupId: string, { type, search }: { type?: ProviderType; search?: Search } = {}) => {
    const params = new URLSearchParams(searchString(search));
    if (type && (PROVIDER_TYPES as readonly string[]).includes(type)) params.set(PROVIDER_TYPE_PARAM, type);
    return `${groupHome(groupId)}/providers/new${searchString(params)}`;
  },
  /** The import sheet over the directory (copying providers from another group), carrying the list's search and filters. */
  importProviders: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/providers/import${searchString(search)}`,
  /** The edit sheet for one provider, over the directory, carrying the list's search and filters. */
  editProvider: (groupId: string, providerId: string, search?: Search) =>
    `${groupHome(groupId)}/providers/${segment(providerId)}/edit${searchString(search)}`,
  /** A provider's page: details, contact actions and their shared live notes. */
  provider: (groupId: string, providerId: string) => `${groupHome(groupId)}/providers/${segment(providerId)}`,
} as const;
