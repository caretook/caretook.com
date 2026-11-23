import type { SetupStep } from "~/lib/app-shell/gettingStarted";

import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { Link } from "react-router";
import { Card, ICON, IconButton, LINK } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { gettingStartedSteps, inSetupWindow } from "~/lib/app-shell/gettingStarted";
import { useSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { useGroup } from "~/lib/app-shell/group";
import { saveSettings, useCachedSettings } from "~/lib/app-shell/me";
import { InviteSomeoneCard } from "./InviteSomeoneCard";

// The setup card on a new member's timeline, in the invite card's place while
// it shows (14 days from joining, until finished or dismissed). Its steps tick
// themselves off from the group's synced data; the dismissal follows the
// account across devices through the settings path, offline included.

const LABELS: Record<SetupStep["id"], string> = {
  profile: "Add allergies or conditions",
  medication: "Add a medication",
  entry: "Log a first entry",
  invite: "Invite someone to help",
  connect: "Connect your AI assistant",
};

const ROW = "flex min-h-11 items-center gap-2 text-sm";

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

function StepRow({ step, onAddEntry }: { step: SetupStep; onAddEntry: () => void }) {
  if (step.id === "connect")
    return (
      <li className={ROW} data-setup-step={step.id}>
        <Sparkles aria-hidden="true" className={`${ICON} text-faint shrink-0`} />
        <StepAction step={step} onAddEntry={onAddEntry} />
      </li>
    );
  // The invite step carries the invite card's hook only while there's someone to invite.
  const inviteHook = step.id === "invite" && !step.done ? { "data-invite-card": "" } : {};
  return (
    <li className={ROW} data-setup-step={step.id} data-done={step.done ? "" : undefined} {...inviteHook}>
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

export function GettingStartedCard({
  className = "",
  onAddEntry,
}: {
  className?: string;
  onAddEntry: () => void;
}) {
  const { id, userId, role } = useGroup();
  const { setupDismissed } = useCachedSettings(userId);
  const setup = useSetupFacts(id, userId);
  // Until the device answers, neither card: the invite card mustn't flash first.
  if (!setup) return null;
  const plan = gettingStartedSteps({ role, facts: setup.facts });
  const shows =
    plan && !plan.finished && !setupDismissed.includes(id) && inSetupWindow(setup.joinedAt, Date.now());
  if (!shows) return <InviteSomeoneCard className={className} />;
  return (
    <Card
      id="getting-started"
      title="Get started"
      className={className}
      data-setup-card=""
      actions={
        <IconButton
          label="Dismiss setup"
          icon={X}
          onPress={() => void saveSettings(userId, { setupDismissed: [id] }).catch(() => undefined)}
        />
      }
    >
      <p className="text-base-content/70 text-sm">
        {plan.doneCount} of {plan.total} done
      </p>
      <ul>
        {plan.steps.map((step) => (
          <StepRow key={step.id} step={step} onAddEntry={onAddEntry} />
        ))}
      </ul>
    </Card>
  );
}
