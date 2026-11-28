import type { GroupContext } from "~/lib/app-shell/group";
import type { SyncDb } from "~/lib/sync";

import { appUrls } from "~/lib/app-shell/appUrls";
import { readSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { firstUnfinishedStep, setsUpGroup, setupOpened, setupRedirectStep } from "~/lib/app-shell/groupSetup";
import { cachedSettings, loadSettings, settingsKnown } from "~/lib/app-shell/me";
import { onSetupPage } from "~/lib/app-shell/setupNudges";

// A creator's first open of a group goes to its setup pages (onboarding-2,
// B-670): the group layout's middleware asks this on every page load under
// the group. The rules are `setupRedirectStep`'s (pure); this reads what
// they need from the device: the group's synced facts, and the account's
// cached settings. The setup pages store `opened` on open, so the redirect
// happens once per group, on whichever device.
//
// Cheap for everyone else: only an owner who hasn't opened or dismissed the
// group's setup reads the facts, and only the person who sets it up, with
// the flow unfinished, loads the settings (`loadSettings`: the cache at once,
// else the server's first answer, at most `NETWORK_ANSWER_MS`; offline it
// gives up at once and opens the page as asked).

/**
 * The groups this page has already sent to setup, per user: when storage
 * refuses writes, `opened` never reaches the cache, and Later would bring the
 * redirect back on every navigation.
 */
const redirected = new Set<string>();

/** Forget this page's redirects (tests, which start each one afresh). */
export const forgetSetupRedirects = () => redirected.clear();

/** Where this page load should go instead, or null to open it as asked. */
export const setupRedirect = async ({
  request,
  db,
  group,
}: {
  request: Request;
  db: SyncDb;
  group: GroupContext;
}): Promise<string | null> => {
  const { id: groupId, userId, role } = group;
  const key = `${userId}:${groupId}`;
  if (request.method !== "GET" || role !== "owner" || redirected.has(key)) return null;
  if (onSetupPage(new URL(request.url).pathname, groupId)) return null;
  const cached = cachedSettings(userId);
  if (setupOpened(cached.groupSetup, groupId) || cached.setupDismissed.includes(groupId)) return null;

  const { setup: facts } = await readSetupFacts(db, groupId, userId);
  if (!setsUpGroup({ userId, role, facts }) || firstUnfinishedStep(facts) === null) return null;
  // Through the loaders' path, not the bare cache: with no cached copy (storage
  // cleared or refusing writes while this page knows the settings), it waits
  // for the server's, which may say the group was opened elsewhere.
  const settings = await loadSettings(request, userId);
  const step = setupRedirectStep({
    groupId,
    userId,
    role,
    facts,
    settingsKnown: settingsKnown(userId),
    settings,
  });
  if (!step) return null;
  redirected.add(key);
  return appUrls.setup(groupId, step);
};
