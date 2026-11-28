import type { SetupNudge } from "@caretook/data/schema";

import { useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { dismissToast, toast } from "~/components/ui";
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
// one (session storage). A shown nudge goes with its group (the layout
// unmounts on a switch) and when a setup page opens, so its Open never points
// at the old group's setup or new note.

const MESSAGES: Record<SetupNudge, string> = {
  help: "Want help onboarding?",
  entry: "Log a first entry on the timeline?",
};

/** Under the settings cache's prefix, so signing out (`forgetSettings`) clears it. */
const lastShownKey = (userId: string) => `caretook:settings:${userId}:nudge-shown`;
const sessionKey = (userId: string) => `caretook:setup-nudge-session:${userId}`;

/**
 * This page's own copy of each user's last nudge (ms), set with storage. When
 * storage can't be written (private mode, a full quota), it still spaces the
 * nudges: the session's first counts as shown, and the next waits its slot.
 */
const shownHere = new Map<string, number>();

const readLastShown = (userId: string): number | null => {
  const here = shownHere.get(userId) ?? null;
  try {
    const value = Number(localStorage.getItem(lastShownKey(userId)));
    const stored = Number.isFinite(value) && value > 0 ? value : null;
    return stored === null ? here : Math.max(stored, here ?? 0);
  } catch {
    return here;
  }
};

const readSessionShown = (userId: string) => {
  if (shownHere.has(userId)) return true;
  try {
    return sessionStorage.getItem(sessionKey(userId)) === "1";
  } catch {
    return false;
  }
};

/** Remember a nudge shown now: on this page first, then on this device and in this session. */
const markShown = (userId: string, now: number) => {
  shownHere.set(userId, now);
  try {
    localStorage.setItem(lastShownKey(userId), String(now));
    sessionStorage.setItem(sessionKey(userId), "1");
  } catch {
    // No storage: this page's copy spaces the nudges until it reloads.
  }
};

/** Forget this page's copy (tests, which start each one afresh). */
export const forgetShownNudges = () => shownHere.clear();

export function useSetupNudges() {
  const { id: groupId, userId, role } = useGroup();
  const live = useSetupFacts(groupId, userId);
  const settings = useCachedSettings(userId);
  const known = useSettingsKnown(userId);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [wake, bump] = useReducer((n: number) => n + 1, 0);
  const followUpAt = useRef<number | null>(null);
  /** The toast of the nudge this group showed, while it may still be on screen. */
  const shownToast = useRef<string | null>(null);

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

  // Its group's pages gone (another group, or left the group): its nudge goes too.
  useEffect(
    () => () => {
      if (shownToast.current) dismissToast(shownToast.current);
      shownToast.current = null;
    },
    [groupId],
  );

  // A setup page open: the nudge pointing there no longer applies.
  useEffect(() => {
    if (!setupPage || !shownToast.current) return;
    dismissToast(shownToast.current);
    shownToast.current = null;
  }, [setupPage]);

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
      shownToast.current = toast({
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
