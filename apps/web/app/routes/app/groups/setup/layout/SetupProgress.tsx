import type { GroupSetupFacts } from "~/lib/app-shell/groupSetup";
import type { SetupPage } from "./setupPages";

import { CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router";
import { ICON } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { groupSetupSteps } from "~/lib/app-shell/groupSetup";
import { SETUP_PAGES, SETUP_STEP_META } from "./setupPages";

/**
 * Where the flow is: each step with a page, done (ticked from the group's
 * synced data) or not, the current one marked. Each is a link, so any step
 * can be skipped to.
 */
export function SetupProgress({
  groupId,
  facts,
  current,
}: {
  groupId: string;
  facts: GroupSetupFacts;
  current: SetupPage | null;
}) {
  const done = new Map(groupSetupSteps(facts).map((s) => [s.id, s.done]));
  const at = current ? SETUP_PAGES.indexOf(current) + 1 : 0;
  return (
    <nav aria-label="Setup steps" data-setup-progress="">
      {at > 0 && (
        <p className="text-muted text-sm">
          Step {at} of {SETUP_PAGES.length}
        </p>
      )}
      <ol className="flex flex-wrap gap-x-4">
        {SETUP_PAGES.map((step) => {
          const isDone = done.get(step) ?? false;
          const Icon = isDone ? CheckCircle2 : Circle;
          return (
            <li key={step} data-setup-step={step} data-done={isDone ? "" : undefined}>
              <Link
                to={appUrls.setup(groupId, step)}
                aria-current={step === current ? "step" : undefined}
                className="inline-flex min-h-11 items-center gap-1.5 text-sm aria-[current=step]:font-semibold"
              >
                <Icon
                  aria-hidden="true"
                  className={`${ICON} shrink-0 ${isDone ? "text-success" : "text-faint"}`}
                />
                {SETUP_STEP_META[step].label}
                {isDone && <span className="sr-only"> (done)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
