import type { ProviderType } from "@caretook/data/schema";

import { PROVIDER_TYPES } from "@caretook/data/schema";
import { appUrls } from "../../../../lib/app-shell/appUrls";
import { PROVIDER_TYPE_PARAM } from "../../../../lib/providers/urls";

// The directory's sheet routes (`providers/new`, `providers/import`, `providers/:providerId/edit`):
// which sheet a URL opens, or where it goes instead. Pure, so web:unit tests
// it; the routes' loaders apply it. Like the timeline's `sheetGuard`.

/** What a sheet URL shows: its sheet, or a redirect (the list, with its search kept). */
export type ProviderSheetDecision<Sheet> = { sheet: Sheet } | { redirect: string };

/** The add sheet: the type the form starts as. */
export type NewProviderSheet = { type: ProviderType };

const isProviderType = (value: string | null): value is ProviderType =>
  (PROVIDER_TYPES as readonly (string | null)[]).includes(value);

/**
 * `providers/new` (`?type=` starts the form as that type; an unknown or
 * missing one starts as a clinician). A viewer gets the list instead.
 */
export const newProviderGuard = ({
  groupId,
  search,
  canWrite,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
}): ProviderSheetDecision<NewProviderSheet> => {
  if (!canWrite) return { redirect: appUrls.providers(groupId, search) };
  const type = new URLSearchParams(search).get(PROVIDER_TYPE_PARAM);
  return { sheet: { type: isProviderType(type) ? type : "clinician" } };
};

/**
 * `providers/:providerId/edit`: a live provider in this group, for a writer.
 * A viewer, and a provider that's missing, deleted or in another group, get
 * the list (with no names: a missing provider and another group's look the
 * same).
 */
export const editProviderGuard = <P extends { groupId: string; deletedAt: string | null }>({
  groupId,
  search,
  canWrite,
  provider,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
  provider: P | null;
}): ProviderSheetDecision<P> => {
  if (!canWrite || !provider || provider.groupId !== groupId || provider.deletedAt)
    return { redirect: appUrls.providers(groupId, search) };
  return { sheet: provider };
};

/**
 * `providers/import`: the user's other groups to import from, for a writer
 * here. A viewer, and a writer in no other group, get the list.
 */
export const importProvidersGuard = <G extends { id: string }>({
  groupId,
  search,
  canWrite,
  groups,
}: {
  groupId: string;
  search: string;
  canWrite: boolean;
  /** Every group the user belongs to (this one included or not). */
  groups: readonly G[];
}): ProviderSheetDecision<G[]> => {
  const others = groups.filter((g) => g.id !== groupId);
  if (!canWrite || others.length === 0) return { redirect: appUrls.providers(groupId, search) };
  return { sheet: others };
};

/** The list, or one of its sheets: `providers`, `providers/new`, `providers/import`, `providers/<id>/edit`. */
const isListOrSheet = (groupId: string, pathname: string) => {
  const base = appUrls.providers(groupId);
  if (pathname === base || pathname === `${base}/new` || pathname === `${base}/import`) return true;
  if (!pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length + 1).split("/");
  return rest.length === 2 && rest[0] !== "" && rest[1] === "edit";
};

/**
 * True when a navigation only opens or closes a sheet over the directory:
 * both ends are this group's list or a sheet over it. The list keeps what
 * it loaded (its live query follows every change anyway).
 */
export const onlyProviderSheetChanged = (groupId: string, current: URL, next: URL) =>
  current.pathname !== next.pathname &&
  isListOrSheet(groupId, current.pathname) &&
  isListOrSheet(groupId, next.pathname);
