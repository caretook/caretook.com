import type { LiveEntryKind } from "./liveEntry";

import { groupHome, searchString, segment } from "../core/urls";
import { START_AT_PARAM } from "../timeline/urls";
import { isLiveEntryKind, NEW_ENTRY } from "./liveEntry";

/** A new entry that opens the time picker first: `entries/new?kind=event&when=pick`. */
export const WHEN_PARAM = "when";
export const WHEN_PICK = "pick";
/** A new appointment's provider, linked once it's saved: `entries/new?kind=event&when=pick&provider=<id>`. */
export const WITH_PROVIDER_PARAM = "provider";
/** An entry page opened to print it (`entries/<id>?print=1`): it prints once, then drops the parameter. */
export const PRINT_PARAM = "print";

export const liveNoteUrls = {
  /** A note's or event's page (also a share link). */
  entry: (groupId: string, entryId: string) => `${groupHome(groupId)}/entries/${segment(entryId)}`,
  /** A new note or event (a draft until its first change), starting at `at` when given. An unknown kind is dropped. */
  newEntry: (groupId: string, kind: LiveEntryKind, { at }: { at?: string } = {}) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({
      kind: isLiveEntryKind(kind) ? kind : null,
      [START_AT_PARAM]: at,
    })}`,
  /** A note's or event's page, opened to print it (the ⋯ menu's Print on a row). */
  printEntry: (groupId: string, entryId: string) =>
    `${groupHome(groupId)}/entries/${segment(entryId)}${searchString({ [PRINT_PARAM]: "1" })}`,
} as const;
