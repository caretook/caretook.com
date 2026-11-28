import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { Outlet, redirect, useLocation } from "react-router";
import { Button, Page, PageHeader } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { readSetupFacts, useSetupFacts } from "~/lib/app-shell/gettingStarted.sync";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { setsUpGroup, setupOpened } from "~/lib/app-shell/groupSetup";
import { cachedSettings, saveSettings } from "~/lib/app-shell/me";
import { sessionContext } from "~/lib/auth/session";
import { nextSetupPage, SETUP_STEP_META, setupPageAt } from "./setupPages";
import { SetupProgress } from "./SetupProgress";

// Shared by web + native; client-only. `/app/groups/:groupId/setup/<step>`:
// the setup pages of a group, for the person who sets it up (its earliest
// member, while an owner; `lib/app-shell/groupSetup.ts`). Anyone else, or a
// role that can't write, is sent to the Timeline. Opening it records
// `opened` for the group on the account (offline, it's pending), so the
// first-open redirect never comes back and leaving any way counts as Later.
// The frame: the step's heading, progress, the step's page, then Later and
// Next (the last page's Next finishes on the Timeline).

export const meta = () => [{ title: "Set up · Caretook" }];

export async function clientLoader({ context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const timeline = appUrls.timeline(group.id);
  if (!group.canWrite) throw redirect(timeline);
  const { db } = context.get(sessionContext);
  const { setup } = await readSetupFacts(db, group.id, group.userId);
  if (!setsUpGroup({ userId: group.userId, role: group.role, facts: setup })) throw redirect(timeline);
  if (!setupOpened(cachedSettings(group.userId).groupSetup, group.id))
    void saveSettings(group.userId, { groupSetup: { [group.id]: { opened: true } } }).catch(() => undefined);
  return { facts: setup };
}

/** A step's save writes on the device and the progress follows it live: no reload. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function SetupLayout({ loaderData }: Route.ComponentProps) {
  const { id: groupId, userId } = useGroup();
  const live = useSetupFacts(groupId, userId);
  const facts = live?.setup ?? loaderData.facts;
  const current = setupPageAt(useLocation().pathname);
  const next = current && nextSetupPage(current);
  const heading = current ? SETUP_STEP_META[current] : null;
  const timeline = appUrls.timeline(groupId);
  return (
    <Page data-setup-page={current ?? ""}>
      {heading && <PageHeader title={heading.title} description={heading.description} />}
      <SetupProgress groupId={groupId} facts={facts} current={current} />
      <Outlet />
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button to={timeline} variant="ghost" data-setup-later="">
          Later, take me to Caretook!
        </Button>
        <Button to={next ? appUrls.setup(groupId, next) : timeline} variant="primary" data-setup-next="">
          Next
        </Button>
      </div>
    </Page>
  );
}
