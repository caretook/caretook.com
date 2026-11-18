import type { Route } from "./+types/home";

import type { GroupRow } from "~/lib/sync/timeline";

import { Link, redirect } from "react-router";
import { FirstSyncPending } from "~/components/FirstSyncPending";
import { requireSession } from "~/lib/session";
import { useLiveQuery, waitForFirstSync } from "~/lib/sync";
import { myGroupsQuery, readRows, toMyGroup } from "~/lib/sync/timeline";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Caretook" }];
}

const timelinePath = (groupId: string) => `/app/groups/${groupId}/timeline`;

// Groups come from the device's synced copy. With a single group (the usual
// case) go straight to its timeline. On a new device whose first sync is
// slow, say so (and reload when it lands) rather than "no care group".
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { db } = await requireSession(request);
  const synced = await waitForFirstSync(db);
  const rows = await readRows<GroupRow>(db, myGroupsQuery(db.userId));
  if (rows.length === 1 && rows[0]) throw redirect(timelinePath(rows[0].id));
  return { userId: db.userId, rows, synced };
}

export default function AppHome({ loaderData }: Route.ComponentProps) {
  const query = myGroupsQuery(loaderData.userId);
  const groups = useLiveQuery<GroupRow>(query.sql, query.params, loaderData.rows).map(toMyGroup);
  if (!loaderData.synced) return <FirstSyncPending />;
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Your care groups</h1>
      {groups.length === 0 ? (
        <p className="text-base-content/70">
          You're not in a care group yet. Ask someone in the group to invite you.
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link to={timelinePath(group.id)} className="card bg-base-100 shadow-sm hover:shadow-md">
                <span className="card-body p-4">
                  <span className="font-semibold">{group.recipient?.displayName ?? group.name}</span>
                  <span className="text-base-content/70 text-sm">{group.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
