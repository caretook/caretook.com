import type { Search } from "../core/urls";
import type { LiveEntryKind } from "../live-notes/liveEntry";

import { groupHome, searchString } from "../core/urls";
import { isLiveEntryKind, NEW_ENTRY } from "../live-notes/liveEntry";
import { WHEN_PARAM, WHEN_PICK, WITH_PROVIDER_PARAM } from "../live-notes/urls";

export const appointmentUrls = {
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
  /** A new appointment with a provider (the time picker first, like `newUpcomingEntry`): linked once it's saved. */
  newAppointmentWith: (groupId: string, providerId: string) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({
      kind: "event",
      [WHEN_PARAM]: WHEN_PICK,
      [WITH_PROVIDER_PARAM]: providerId,
    })}`,
} as const;
