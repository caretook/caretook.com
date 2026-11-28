import { useState } from "react";
import { inSetupWindow, timelineWelcome } from "~/lib/app-shell/gettingStarted";
import { useSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { useGroup } from "~/lib/app-shell/group";
import { setsUpGroup } from "~/lib/app-shell/groupSetup";
import { saveSettings, useCachedSettings } from "~/lib/app-shell/me";
import { InviteSomeoneCard } from "./InviteSomeoneCard";
import { WelcomeCard } from "./WelcomeCard";

// The card under the Timeline's header (onboarding-2): a member who didn't
// set the group up gets the welcome, in the invite card's place, 14 days
// from joining until dismissed (the dismissal follows the account across
// devices through the settings path, offline included). The setter has the
// setup pages instead, so no card here. Otherwise a lone manager gets
// `InviteSomeoneCard`, in the full view only.

/**
 * Where focus goes once the welcome is dismissed, since its button leaves
 * with it: the quick-entry box when there is one, else the page's heading
 * (made focusable for it).
 */
export function focusAfterWelcome(field: HTMLElement | null, heading: HTMLElement | null | undefined) {
  if (field) return field.focus();
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}

export function TimelineWelcome({
  className = "",
  onDismissed,
  easy = false,
}: {
  className?: string;
  /** Called on dismiss, before the card goes: moves focus somewhere sensible (`focusAfterWelcome`). */
  onDismissed?: () => void;
  /** On the easy timeline: its larger type, and no invite card. */
  easy?: boolean;
}) {
  const { id, userId, role } = useGroup();
  const { setupDismissed } = useCachedSettings(userId);
  const setup = useSetupFacts(id, userId);
  // The window is read once per visit: a card doesn't vanish under someone mid-page.
  const [openedAt] = useState(() => Date.now());
  // Until the device answers, neither card: the invite card mustn't flash first.
  if (!setup) return null;
  const text = timelineWelcome({ role, setsUp: setsUpGroup({ userId, role, facts: setup.setup }) });
  if (!text || setupDismissed.includes(id) || !inSetupWindow(setup.joinedAt, openedAt))
    return easy ? null : <InviteSomeoneCard className={className} />;
  const dismiss = () => {
    onDismissed?.();
    void saveSettings(userId, { setupDismissed: [id] }).catch(() => undefined);
  };
  return <WelcomeCard text={text} easy={easy} className={className} onDismiss={dismiss} />;
}
