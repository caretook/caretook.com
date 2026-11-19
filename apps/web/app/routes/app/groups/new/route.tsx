import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { newCareGroupZSchema } from "@caretook/data/schema";
import { redirect, useFetcher, useLocation, useNavigate } from "react-router";
import { NewGroupFields, newGroupFromForm } from "~/components/groups";
import { Sheet } from "~/components/ui";
import { toActionResult } from "~/lib/api";
import { appUrls } from "~/lib/appUrls";
import { rpc } from "~/lib/rpc";
import { sessionContext } from "~/lib/session";
import { waitForMembership } from "~/lib/sync/members";
import { openedFromApp } from "./newGroupLink";

// Shared by web + native. `/app/groups/new`: start another care group. The
// sheet asks who you care for; the API creates the group, its recipient and
// you as its owner (online only). Once the new membership has synced to
// this device, its empty timeline opens (with the Invite someone card).

export function meta() {
  return [{ title: "New care group · Caretook" }];
}

const NEEDS_CONNECTION = "Needs a connection to create a care group.";

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<ActionResult> {
  const { db } = context.get(sessionContext);
  const parsed = newCareGroupZSchema.safeParse(newGroupFromForm(await request.formData()));
  if (!parsed.success) {
    return {
      ok: false,
      error: "",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  let groupId: string;
  try {
    ({ groupId } = await rpc.careGroup.create(parsed.data));
  } catch (e) {
    if (e instanceof TypeError) return { ok: false, error: NEEDS_CONNECTION, issues: [] };
    return toActionResult(e);
  }
  // Open it once it's on this device; on a slow sync, the group list (it
  // shows up there when it arrives).
  const here = await waitForMembership(db, { groupId, userId: db.userId });
  throw redirect(here ? appUrls.timeline(groupId) : appUrls.home());
}

export default function NewGroupSheet() {
  const navigate = useNavigate();
  const location = useLocation();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const close = () => {
    if (openedFromApp(location.state)) void navigate(-1);
    else void navigate(appUrls.home(), { replace: true });
  };
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Sheet isOpen onOpenChange={(open) => !open && close()} title="New care group">
        <fetcher.Form method="post" className="space-y-2" data-new-group-form="">
          <p className="text-base-content/70 text-sm">
            Who do you care for? You'll be the group's owner, and can invite others next.
          </p>
          <NewGroupFields issues={result && !result.ok ? result.issues : []} />
          {result && !result.ok && result.error && (
            <p role="alert" className="text-error text-sm">
              {result.error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? "Creating…" : "Create care group"}
          </button>
        </fetcher.Form>
      </Sheet>
    </main>
  );
}
