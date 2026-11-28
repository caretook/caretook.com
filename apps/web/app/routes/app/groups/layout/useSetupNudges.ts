import type { SetupNudge } from "@caretook/data/schema";

import { useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { useGroup } from "~/lib/app-shell/group";
import { firstUnfinishedStep } from "~/lib/app-shell/groupSetup";
import { saveSettings, useCachedSettings, useSettingsKnown } from "~/lib/app-shell/me";
import {
  nextSetupNudge,
  onSetupPage,
  SETUP_NUDGE_FOLLOW_UP_MS,
  SETUP_NUDGE_TIMEOUT,
} from "~/lib/app-shell/setupNudges";

// The setup nudges (onboarding-2) for the group on screen: the group layout
// runs this once. It asks the pure scheduler (`lib/app-shell/setupNudges.ts`)
// on open, when the page becomes visible or focused, when the facts, the
// settings or the page change, and at the time it names; shows the nudge due
// as a toast with Open and Don't ask again; and stores Don't ask again for the
// group through the settings path (pending offline), the next nudge following
// `SETUP_NUDGE_FOLLOW_UP_MS` later. The device's own timing: the last time it
// showed a nudge (local storage) and whether this browser session has shown
// one (session storage).

const MESSAGES: Record<SetupNudge, string> = {
  help: "Want help onboarding?",
  entry: "Log a first entry on the timeline?",
};

/** Under the settings cache's prefix, so signing out (`forgetSettings`) clears it. */
const lastShownKey = (userId: string) => `caretook:settings:${userId}:nudge-shown`;
const sessionKey = (userId: string) => `caretook:setup-nudge-session:${userId}`;

const readLastShown = (userId: string): number | null => {
  try {
    const value = Number(localStorage.getItem(lastShownKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const readSessionShown = (userId: string) => {
  try {
    return sessionStorage.getItem(sessionKey(userId)) === "1";
  } catch {
    return false;
  }
};

/** Remember a nudge shown now, on this device and in this session. */
const markShown = (userId: string, now: number) => {
  try {
    localStorage.setItem(lastShownKey(userId), String(now));
    sessionStorage.setItem(sessionKey(userId), "1");
  } catch {
    // No storage: the session's first nudge comes again next time.
  }
};

export function useSetupNudges() {
  const { id: groupId, userId, role } = useGroup();
  const live = useSetupFacts(groupId, userId);
  const settings = useCachedSettings(userId);
  const known = useSettingsKnown(userId);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [wake, bump] = useReducer((n: number) => n + 1, 0);
  const followUpAt = useRef<number | null>(null);

  const facts = useMemo(() => (live ? { ...live.setup, hasEntry: live.facts.hasEntry } : null), [live]);
  const setupPage = onSetupPage(pathname, groupId);

  useEffect(() => {
    document.addEventListener("visibilitychange", bump);
    window.addEventListener("focus", bump);
    return () => {
      document.removeEventListener("visibilitychange", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  useEffect(() => {
    if (document.visibilityState === "hidden") return;
    const now = Date.now();
    const plan = nextSetupNudge({
      groupId,
      userId,
      role,
      facts,
      settingsKnown: known,
      settings,
      onSetupPage: setupPage,
      now,
      lastShownAt: readLastShown(userId),
      shownThisSession: readSessionShown(userId),
      followUpAt: followUpAt.current,
    });
    if (plan.nudge) {
      const nudge = plan.nudge;
      markShown(userId, now);
      followUpAt.current = null;
      const to =
        nudge === "help"
          ? appUrls.setup(groupId, (facts && firstUnfinishedStep(facts)) ?? undefined)
          : appUrls.newEntry(groupId, "note");
      toast({
        message: MESSAGES[nudge],
        timeout: SETUP_NUDGE_TIMEOUT,
        data: { "data-setup-nudge": nudge },
        action: { label: "Open", onAction: () => void navigate(to) },
        secondAction: {
          label: "Don't ask again",
          onAction: () => {
            followUpAt.current = Date.now() + SETUP_NUDGE_FOLLOW_UP_MS;
            void saveSettings(userId, { groupSetup: { [groupId]: { retired: [nudge] } } }).catch(
              () => undefined,
            );
            bump();
          },
        },
      });
      // Look again, to set the next slot's timer.
      bump();
      return;
    }
    if (plan.checkAt === null) return;
    const timer = setTimeout(bump, Math.max(0, plan.checkAt - now));
    return () => clearTimeout(timer);
  }, [groupId, userId, role, facts, known, settings, setupPage, navigate, wake]);
}
