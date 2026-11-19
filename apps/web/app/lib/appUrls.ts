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

/** The Dose sheet's medication and the slot it answers: `?medication=<id>&slot=08:00`. */
export const DOSE_MEDICATION_PARAM = "medication";
export const DOSE_SLOT_PARAM = "slot";

/** `search` without the add sheets' own parameters: the timeline's filters, as a sheet carries them. */
export const withoutSheetParams = (search?: Search) => {
  const params = new URLSearchParams(searchString(search));
  params.delete(VITAL_TYPE_PARAM);
  params.delete(DOSE_MEDICATION_PARAM);
  params.delete(DOSE_SLOT_PARAM);
  return params;
};

/** A new provider's type (`providers/new?type=pharmacy`), the same parameter as the directory's type filter. */
export const PROVIDER_TYPE_PARAM = "type";

/** A new entry that opens the time picker first: `entries/new?kind=event&when=pick`. */
export const WHEN_PARAM = "when";
export const WHEN_PICK = "pick";

/** The recipient's profile's edit sheets, in the order the page shows them (`…/profile/<sheet>`). */
export const PROFILE_SHEETS = ["basics", "contact", "insurance", "emergency"] as const;
export type ProfileSheet = (typeof PROFILE_SHEETS)[number];
const isProfileSheet = (sheet: unknown): sheet is ProfileSheet =>
  (PROFILE_SHEETS as readonly unknown[]).includes(sheet);

const HOME = "/app";

/** The account's settings subpages, in list order (`/app/settings/<page>`). */
export const ACCOUNT_SETTINGS_PAGES = ["units", "timeline", "account", "contact"] as const;
export type AccountSettingsPage = (typeof ACCOUNT_SETTINGS_PAGES)[number];
const isAccountSettingsPage = (page: unknown): page is AccountSettingsPage =>
  (ACCOUNT_SETTINGS_PAGES as readonly unknown[]).includes(page);
const groupHome = (groupId: string) => `${HOME}/groups/${segment(groupId)}`;

/** A group's settings subpages, in list order (`…/settings/<page>`). */
export const GROUP_SETTINGS_PAGES = ["details", "members"] as const;
export type GroupSettingsPage = (typeof GROUP_SETTINGS_PAGES)[number];
const isGroupSettingsPage = (page: unknown): page is GroupSettingsPage =>
  (GROUP_SETTINGS_PAGES as readonly unknown[]).includes(page);

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
  /**
   * The edit sheet for a symptom or vital over a group's timeline, carrying
   * the timeline's filters (the add sheet's own `type` is dropped).
   */
  editSheet: (groupId: string, entryId: string, { search }: { search?: Search } = {}) =>
    `${groupHome(groupId)}/timeline/${segment(entryId)}/edit${searchString(withoutSheetParams(search))}`,
  /** A note's or event's page (also a share link). */
  entry: (groupId: string, entryId: string) => `${groupHome(groupId)}/entries/${segment(entryId)}`,
  /** A new note or event (a draft until its first change). An unknown kind is dropped. */
  newEntry: (groupId: string, kind: LiveEntryKind) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({ kind: isLiveEntryKind(kind) ? kind : null })}`,
  /**
   * A group's settings: the list, or one of its subpages. An unknown subpage
   * is dropped (the list).
   */
  groupSettings: (groupId: string, page?: GroupSettingsPage) =>
    `${groupHome(groupId)}/settings${isGroupSettingsPage(page) ? `/${page}` : ""}`,
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
  /** Start another care group: who you care for, then its timeline. */
  newGroup: () => `${HOME}/groups/new`,
  /** A group's medication list, with its search and status filter (`?q=`, `?status=`) carried through. */
  medications: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/medications${searchString(search)}`,
  /**
   * The Dose sheet over a group's timeline, carrying the timeline's filters.
   * It can start on one medication, and the slot the dose answers ("08:00").
   */
  newDose: (
    groupId: string,
    { medicationId, slot, search }: { medicationId?: string; slot?: string; search?: Search } = {},
  ) => {
    const params = withoutSheetParams(search);
    if (medicationId) params.set(DOSE_MEDICATION_PARAM, medicationId);
    if (slot) params.set(DOSE_SLOT_PARAM, slot);
    return `${groupHome(groupId)}/timeline/new/dose${searchString(params)}`;
  },
  /** A medication's page: details, schedule, providers, refills, its live notes and its history. */
  medication: (groupId: string, medicationId: string) =>
    `${groupHome(groupId)}/medications/${segment(medicationId)}`,
  /** The printable medication sheet: current and recently stopped medications, and who to call. */
  medicationsPrint: (groupId: string) => `${groupHome(groupId)}/medications/print`,
  /**
   * A group's Upcoming section, with its filters carried through: pass the
   * timeline's `{ kind, author }` (or a search string) and they're kept.
   */
  upcoming: (groupId: string, search?: Search) => `${groupHome(groupId)}/upcoming${searchString(search)}`,
  /** Upcoming's Past tab (past events, newest first), with its filters carried through. */
  pastEvents: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/upcoming/past${searchString(search)}`,
  /**
   * A new appointment (an event) or reminder (a note) that opens the time
   * picker first (`?when=pick`): a draft like `newEntry`. An unknown kind is dropped.
   */
  newUpcomingEntry: (groupId: string, kind: LiveEntryKind) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({
      kind: isLiveEntryKind(kind) ? kind : null,
      [WHEN_PARAM]: WHEN_PICK,
    })}`,
  /** The add sheet over the medication list, carrying the list's search and status filter. */
  newMedication: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/medications/new${searchString(search)}`,
  /** The edit sheet for one medication, over the list, carrying the list's search and status filter. */
  editMedication: (groupId: string, medicationId: string, search?: Search) =>
    `${groupHome(groupId)}/medications/${segment(medicationId)}/edit${searchString(search)}`,
  /**
   * The care recipient's profile (not a group section), or one of its edit
   * sheets over it. An unknown sheet is dropped (the profile).
   */
  profile: (groupId: string, sheet?: ProfileSheet) =>
    `${groupHome(groupId)}/profile${isProfileSheet(sheet) ? `/${sheet}` : ""}`,
} as const;
