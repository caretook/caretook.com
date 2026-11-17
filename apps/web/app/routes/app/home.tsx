import type { Route } from "./+types/home";

import { Link, redirect } from "react-router";
import { load } from "~/lib/api";
import { rpc } from "~/lib/rpc";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Caretook" }];
}

const timelinePath = (groupId: string) => `/app/groups/${groupId}/timeline`;

// With a single group (the usual case) go straight to its timeline.
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const groups = await load(request, rpc.careGroup.listMine());
  if (groups.length === 1 && groups[0]) throw redirect(timelinePath(groups[0].id));
  return { groups };
}

export default function AppHome({ loaderData }: Route.ComponentProps) {
  const { groups } = loaderData;
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
