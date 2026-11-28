import type { QuickEntryCommand, QuickEntryPage } from "@caretook/data/domain";
import type { NavigateFunction } from "react-router";

import { appUrls } from "~/lib/app-shell/appUrls";
import { setDay } from "~/lib/timeline/timelineFilters";
import { JUMP_LINK_STATE } from "~/lib/timeline/timelineJump";
import { withoutSheetParams } from "~/lib/timeline/urls";

// Running a quick entry command (`readCommand`): its page's URL, opened here
// or in a new tab. A command saves nothing and never reaches the runner; it
// only moves this device's screen. The native app has no tabs, so it opens
// everything in place.

/** Where each page a command names opens: the section's own page, or the settings subpage. */
const PAGE_URLS: Record<QuickEntryPage, (groupId: string) => string> = {
  timeline: (groupId) => appUrls.timeline(groupId),
  todos: (groupId) => appUrls.todos(groupId),
  planner: (groupId) => appUrls.planner(groupId),
  // The Medications section opens on its Schedule tab (`GROUP_SECTIONS`).
  medications: (groupId) => appUrls.medicationSchedule(groupId),
  medicationSchedule: (groupId) => appUrls.medicationSchedule(groupId),
  providers: (groupId) => appUrls.providers(groupId),
  carePeriods: (groupId) => appUrls.periods(groupId),
  profile: (groupId) => appUrls.profile(groupId),
  // A reader's allergies sheet redirects to the profile, where the allergies show.
  allergies: (groupId) => appUrls.profileAllergies(groupId),
  settings: () => appUrls.settings(),
  members: (groupId) => appUrls.groupSettings(groupId, "members"),
  tags: (groupId) => appUrls.groupSettings(groupId, "tags"),
  search: (groupId) => appUrls.search(groupId),
};

/**
 * The URL a command opens. A day is the timeline on that day, keeping the
 * timeline's own filters when the box is on the timeline (none from another page).
 */
export function commandUrl(
  command: QuickEntryCommand,
  { groupId, pathname, search }: { groupId: string; pathname: string; search: string },
): string {
  if (command.kind === "page") return PAGE_URLS[command.page](groupId);
  const kept = pathname === appUrls.timeline(groupId) ? withoutSheetParams(search).toString() : "";
  return appUrls.timeline(groupId, setDay(`?${kept}`, command.day));
}

/** Whether a command opens in a new tab here: the native app has no tabs, so it opens in place. */
export const inNewTab = (command: QuickEntryCommand) =>
  command.newTab && import.meta.env.BUILD_TARGET !== "native";

/**
 * Run a command: open its URL in a new tab when it asks for one (and the
 * build has tabs), else navigate here. A day jumps the timeline as its own
 * day picker does (`JUMP_LINK_STATE`).
 */
export async function runCommand(
  command: QuickEntryCommand,
  {
    groupId,
    pathname,
    search,
    navigate,
  }: { groupId: string; pathname: string; search: string; navigate: NavigateFunction },
): Promise<void> {
  const url = commandUrl(command, { groupId, pathname, search });
  if (inNewTab(command)) {
    window.open(url, "_blank", "noopener");
    return;
  }
  await navigate(
    url,
    command.kind === "day" ? { state: JUMP_LINK_STATE, preventScrollReset: true } : undefined,
  );
}
