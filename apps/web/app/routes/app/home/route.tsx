import type { Route } from "./+types/route";

import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { Link, redirect } from "react-router";
import { FirstSyncPending } from "~/components/shell";
import { appUrls, GROUP_LIST_PARAM } from "~/lib/app-shell/appUrls";
import { rememberedGroup, resolveHomeGroup } from "~/lib/app-shell/lastGroup";
import { sessionContext } from "~/lib/auth/session";
import { useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { myGroupsQuery, readRows, toMyGroup } from "~/lib/timeline/timeline.sync";
import { loadMyRequests, PendingRequests, WITHDRAW_INTENT, withdrawRequest } from "./PendingRequests";
import { NewGroupLink } from "./NewGroupLink";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Caretook" }];
}

// Groups come from the device's synced copy. Go straight to the group last
// opened on this device, or the only group (the usual case). On a new device
// whose first sync is slow, say so (and reload when it lands) rather than
// "no care group".
//
// `?groups=1` (`appUrls.groupList`) always shows the list: simple mode has no
// group menu, so it's how a member there reaches their other groups.
export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { db } = context.get(sessionContext);
  const synced = await waitForFirstSync(db);
  const rows = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  const listed = new URL(request.url).searchParams.has(GROUP_LIST_PARAM);
  const home = listed ? null : resolveHomeGroup({ groups: rows, remembered: rememberedGroup(db.userId) });
  if (home) throw redirect(appUrls.timeline(home));
  return { userId: db.userId, rows, synced, requests: await loadMyRequests() };
}

// The only write here: withdrawing a waiting request (online, through the
// API). The loader then runs again, so the row goes.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const requestId = form.get("requestId");
  if (form.get("intent") !== WITHDRAW_INTENT || typeof requestId !== "string")
    return { ok: false as const, error: "Something went wrong.", issues: [] };
  return withdrawRequest(requestId);
}

export default function AppHome({ loaderData }: Route.ComponentProps) {
  const query = myGroupsQuery(loaderData.userId);
  const groups = useLiveQuery<GroupRow>(query.sql, query.params, loaderData.rows).map(toMyGroup);
  if (!loaderData.synced) return <FirstSyncPending />;
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Your care groups</h1>
      <PendingRequests requests={loaderData.requests} groupIds={groups.map((g) => g.id)} />
      {groups.length === 0 ? (
        <p className="text-base-content/70">
          You're not in a care group yet. Ask someone in the group to invite you.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={appUrls.timeline(group.id)} className="card bg-base-100 shadow-sm hover:shadow-md">
                <span className="card-body p-4">
                  <span className="font-semibold">{group.recipient?.displayName ?? group.name}</span>
                  <span className="text-base-content/70 text-sm">{group.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewGroupLink />
    </main>
  );
}
