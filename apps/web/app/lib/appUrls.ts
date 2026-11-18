import type { LiveEntryKind } from "./liveEntry";

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

const HOME = "/app";
const groupHome = (groupId: string) => `${HOME}/groups/${segment(groupId)}`;

export const appUrls = {
  /** `/app`: the last group's timeline, the only group's, or the list of groups. */
  home: () => HOME,
  /** The account's settings. */
  settings: () => `${HOME}/settings`,
  /** A care group on its own (it goes on to the timeline). */
  groupHome,
  /** A group's timeline, with its filters (`?kind=`, `?author=`) carried through. */
  timeline: (groupId: string, search?: Search) => `${groupHome(groupId)}/timeline${searchString(search)}`,
  /** A note's or event's page (also a share link). */
  entry: (groupId: string, entryId: string) => `${groupHome(groupId)}/entries/${segment(entryId)}`,
  /** A new note or event (a draft until its first change). An unknown kind is dropped. */
  newEntry: (groupId: string, kind: LiveEntryKind) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({ kind: isLiveEntryKind(kind) ? kind : null })}`,
  /** A group's settings. */
  groupSettings: (groupId: string) => `${groupHome(groupId)}/settings`,
} as const;
