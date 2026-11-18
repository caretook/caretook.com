import type { ProviderType, TimelineEntryKind, VitalType } from "@caretook/data/schema";
import type { LiveEntryKind } from "./liveEntry";

import { PROVIDER_TYPES, VITAL_TYPES } from "@caretook/data/schema";
import { isLiveEntryKind, NEW_ENTRY } from "./liveEntry";

// Every path inside the app, built in one place. Links, redirects and
// navigations call these; nothing else writes an `/app/…` string, so moving a
// route changes one function here (and `routes.ts`), not every link.
//
// - Ids are encoded as path segments.
// - A search is carried through: a string (with or without the `?`),
//   `URLSearchParams`, or a record whose null, undefined and empty values are
//   dropped. Parameters with an empty value are dropped from any of them.
// - No React or router here; unit-tested in web:unit.

/** A search to carry onto a path. */
export type Search = string | URLSearchParams | Record<string, string | null | undefined>;

const segment = (value: string) => encodeURIComponent(value);

/** `?a=1&b=2`, or "" when there's nothing to carry. */
export const searchString = (search?: Search): string => {
  if (!search) return "";
  const source =
    typeof search === "string" || search instanceof URLSearchParams
      ? new URLSearchParams(search)
      : new URLSearchParams(Object.entries(search).filter((pair): pair is [string, string] => !!pair[1]));
  const out = new URLSearchParams();
  for (const [key, value] of source) if (value !== "") out.append(key, value);
  const text = out.toString();
  return text ? `?${text}` : "";
};

/** The kinds added in a sheet over the timeline (notes and events have a page: `newEntry`). */
export const SHEET_KINDS = ["symptom", "vital"] as const satisfies readonly TimelineEntryKind[];
export type SheetKind = (typeof SHEET_KINDS)[number];
export const isSheetKind = (value: unknown): value is SheetKind =>
  (SHEET_KINDS as readonly unknown[]).includes(value);

/** A new vital's first reading: `?type=heartRate`. */
export const VITAL_TYPE_PARAM = "type";
export const isVitalType = (value: unknown): value is VitalType =>
  (VITAL_TYPES as readonly unknown[]).includes(value);

/** `search` without the add sheet's own parameter: the timeline's filters, as a sheet carries them. */
export const withoutSheetParams = (search?: Search) => {
  const params = new URLSearchParams(searchString(search));
  params.delete(VITAL_TYPE_PARAM);
  return params;
};

/** A new provider's type (`providers/new?type=pharmacy`), the same parameter as the directory's type filter. */
export const PROVIDER_TYPE_PARAM = "type";

const HOME = "/app";

/** The account's settings subpages, in list order (`/app/settings/<page>`). */
export const ACCOUNT_SETTINGS_PAGES = ["units", "timeline", "account"] as const;
export type AccountSettingsPage = (typeof ACCOUNT_SETTINGS_PAGES)[number];
const isAccountSettingsPage = (page: unknown): page is AccountSettingsPage =>
  (ACCOUNT_SETTINGS_PAGES as readonly unknown[]).includes(page);
const groupHome = (groupId: string) => `${HOME}/groups/${segment(groupId)}`;

export const appUrls = {
  /** `/app`: the last group's timeline, the only group's, or the list of groups. */
  home: () => HOME,
  /**
   * The account's settings: the list, or one of its subpages. An unknown
   * subpage is dropped (the list).
   */
  settings: (page?: AccountSettingsPage) =>
    `${HOME}/settings${isAccountSettingsPage(page) ? `/${page}` : ""}`,
  /** A care group on its own (it goes on to the timeline). */
  groupHome,
  /** A group's timeline, with its filters (`?kind=`, `?author=`) carried through. */
  timeline: (groupId: string, search?: Search) => `${groupHome(groupId)}/timeline${searchString(search)}`,
  /**
   * The add sheet over a group's timeline, carrying the timeline's filters.
   * A vital can start with a reading's `type`; an unknown type, or a type on
   * a symptom, is dropped. An unknown kind is the timeline itself.
   */
  newSheet: (
    groupId: string,
    kind: SheetKind,
    { type, search }: { type?: VitalType; search?: Search } = {},
  ) => {
    const params = withoutSheetParams(search);
    if (!isSheetKind(kind)) return `${groupHome(groupId)}/timeline${searchString(params)}`;
    if (kind === "vital" && isVitalType(type)) params.set(VITAL_TYPE_PARAM, type);
    return `${groupHome(groupId)}/timeline/new/${kind}${searchString(params)}`;
  },
  /** A note's or event's page (also a share link). */
  entry: (groupId: string, entryId: string) => `${groupHome(groupId)}/entries/${segment(entryId)}`,
  /** A new note or event (a draft until its first change). An unknown kind is dropped. */
  newEntry: (groupId: string, kind: LiveEntryKind) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({ kind: isLiveEntryKind(kind) ? kind : null })}`,
  /** A group's settings. */
  groupSettings: (groupId: string) => `${groupHome(groupId)}/settings`,
  /** A group's provider directory, with its search and filters (`?q=`, `?type=`, `?past=1`) carried through. */
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
  /** The edit sheet for one provider, over the directory, carrying the list's search and filters. */
  editProvider: (groupId: string, providerId: string, search?: Search) =>
    `${groupHome(groupId)}/providers/${segment(providerId)}/edit${searchString(search)}`,
  /** A provider's page: details, contact actions and their shared live notes. */
  provider: (groupId: string, providerId: string) => `${groupHome(groupId)}/providers/${segment(providerId)}`,
} as const;
