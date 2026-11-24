import type { SetupStep } from "~/lib/app-shell/gettingStarted";

import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Card, ICON, IconButton, LINK } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { gettingStartedSteps, inSetupWindow } from "~/lib/app-shell/gettingStarted";
import { useSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { useGroup } from "~/lib/app-shell/group";
import { saveSettings, useCachedSettings } from "~/lib/app-shell/me";
import { InviteSomeoneCard } from "./InviteSomeoneCard";
import { WelcomeCard } from "./WelcomeCard";

// The setup card on a new member's timeline, in the invite card's place while
// it shows (14 days from joining, until finished or dismissed). Its steps tick
// themselves off from the group's synced data; the dismissal follows the
// account across devices through the settings path, offline included. A role
// with no steps gets its welcome instead; the easy view shows either, but has
// no invite card to fall back to.

const LABELS: Record<SetupStep["id"], string> = {
  profile: "Add allergies or conditions",
  medication: "Add a medication",
  entry: "Log a first entry",
  invite: "Invite someone to help",
  connect: "Connect your AI assistant",
};

const ROW = "flex min-h-11 items-center gap-2";

function StepAction({ step, onAddEntry }: { step: SetupStep; onAddEntry: () => void }) {
  const { id: groupId } = useGroup();
  const label = LABELS[step.id];
  const className = `${LINK} text-left`;
  switch (step.id) {
    case "profile":
      return (
        <Link to={appUrls.profile(groupId)} prefetch="render" className={className}>
          {label}
        </Link>
      );
    case "medication":
      return (
        <Link to={appUrls.newMedication(groupId, "list")} prefetch="render" className={className}>
          {label}
        </Link>
      );
    case "entry":
      return (
        <button type="button" onClick={onAddEntry} className={className}>
          {label}
        </button>
      );
    case "invite":
      return (
        <Link to={appUrls.groupSettings(groupId, "members")} prefetch="render" className={className}>
          {label}
        </Link>
      );
    case "connect":
      return (
        <Link
          to={
            step.target === "assistants"
              ? appUrls.groupSettings(groupId, "assistants")
              : appUrls.settings("devices")
          }
          prefetch="render"
          className={className}
        >
          {label}
        </Link>
      );
  }
}

function StepRow({
  step,
  onAddEntry,
  textSize,
}: {
  step: SetupStep;
  onAddEntry: () => void;
  textSize: string;
}) {
  if (step.id === "connect")
    return (
      <li className={`${ROW} ${textSize}`} data-setup-step={step.id}>
        <Sparkles aria-hidden="true" className={`${ICON} text-faint shrink-0`} />
        <StepAction step={step} onAddEntry={onAddEntry} />
      </li>
    );
  // The invite step carries the invite card's hook only while there's someone to invite.
  const inviteHook = step.id === "invite" && !step.done ? { "data-invite-card": "" } : {};
  return (
    <li
      className={`${ROW} ${textSize}`}
      data-setup-step={step.id}
      data-done={step.done ? "" : undefined}
      {...inviteHook}
    >
      {step.done ? (
        <>
          <CheckCircle2 aria-hidden="true" className={`${ICON} text-success shrink-0`} />
          <span className="text-base-content/70 line-through">{LABELS[step.id]}</span>
          <span className="sr-only">Done</span>
        </>
      ) : (
        <>
          <Circle aria-hidden="true" className={`${ICON} text-faint shrink-0`} />
          <StepAction step={step} onAddEntry={onAddEntry} />
        </>
      )}
    </li>
  );
}

/**
 * Where focus goes once a setup or welcome card is dismissed, since its button
 * leaves with it: the quick-entry box when there is one, else the page's
 * heading (made focusable for it).
 */
export function focusAfterSetup(field: HTMLElement | null, heading: HTMLElement | null | undefined) {
  if (field) return field.focus();
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
}

export function GettingStartedCard({
  className = "",
  onAddEntry,
  onDismissed,
  easy = false,
}: {
  className?: string;
  onAddEntry: () => void;
  /** Called on dismiss, before the card goes: moves focus somewhere sensible (`focusAfterSetup`). */
  onDismissed?: () => void;
  /** On the easy timeline: its larger type, and no invite card once this is gone. */
  easy?: boolean;
}) {
  const { id, userId, role } = useGroup();
  const { setupDismissed } = useCachedSettings(userId);
  const setup = useSetupFacts(id, userId);
  // The window is read once per visit: a card doesn't vanish under someone mid-page.
  const [openedAt] = useState(() => Date.now());
  // Until the device answers, neither card: the invite card mustn't flash first.
  if (!setup) return null;
  const plan = gettingStartedSteps({ role, facts: setup.facts });
  const fallback = easy ? null : <InviteSomeoneCard className={className} />;
  if (!plan || setupDismissed.includes(id) || !inSetupWindow(setup.joinedAt, openedAt)) return fallback;
  const dismiss = () => {
    onDismissed?.();
    void saveSettings(userId, { setupDismissed: [id] }).catch(() => undefined);
  };
  if (plan.kind === "welcome")
    return <WelcomeCard text={plan.text} easy={easy} className={className} onDismiss={dismiss} />;
  if (plan.finished) return fallback;
  const textSize = easy ? "text-base" : "text-sm";
  return (
    <Card
      id="getting-started"
      title="Get started"
      className={className}
      data-setup-card=""
      actions={<IconButton label="Dismiss setup" icon={X} onPress={dismiss} />}
    >
      <p className={`text-base-content/70 ${textSize}`}>
        {plan.doneCount} of {plan.total} done
      </p>
      <ul>
        {plan.steps.map((step) => (
          <StepRow key={step.id} step={step} onAddEntry={onAddEntry} textSize={textSize} />
        ))}
      </ul>
    </Card>
  );
}
