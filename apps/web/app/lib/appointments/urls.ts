import type { Search } from "../core/urls";
import type { LiveEntryKind } from "../live-notes/liveEntry";

import { groupHome, searchString } from "../core/urls";
import { isLiveEntryKind, NEW_ENTRY } from "../live-notes/liveEntry";
import { WHEN_PARAM, WHEN_PICK, WITH_PROVIDER_PARAM } from "../live-notes/urls";

export const appointmentUrls = {
  /**
   * A group's Planner (its Planner tab: what's coming, by day), with its
   * filters carried through: pass the timeline's `{ kind, author }` (or a
   * search string) and they're kept.
   */
  planner: (groupId: string, search?: Search) => `${groupHome(groupId)}/planner${searchString(search)}`,
  /** The Planner's Past tab (past events, newest first), with its filters carried through. */
  plannerPast: (groupId: string, search?: Search) =>
    `${groupHome(groupId)}/planner/past${searchString(search)}`,
  /**
   * A new appointment (an event) that opens the time picker first
   * (`?when=pick`): a draft like `newEntry`. Only events are dated ahead, so
   * a note gets no picker (an ordinary new note); an unknown kind is dropped.
   */
  newPlannerEntry: (groupId: string, kind: LiveEntryKind) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({
      kind: isLiveEntryKind(kind) ? kind : null,
      [WHEN_PARAM]: kind === "event" ? WHEN_PICK : null,
    })}`,
  /** A new appointment with a provider (the time picker first, like `newPlannerEntry`): linked once it's saved. */
  newAppointmentWith: (groupId: string, providerId: string) =>
    `${groupHome(groupId)}/entries/${NEW_ENTRY}${searchString({
      kind: "event",
      [WHEN_PARAM]: WHEN_PICK,
      [WITH_PROVIDER_PARAM]: providerId,
    })}`,
} as const;
