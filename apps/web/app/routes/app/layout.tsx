import type { Route } from "./+types/layout";

import { isRouteErrorResponse, Link, Outlet, useLocation, useParams } from "react-router";
import { FirstSyncPending } from "~/components/FirstSyncPending";
import { GroupMenu } from "~/components/GroupMenu";
import { SectionNav, TabBar } from "~/components/SectionNav";
import { SyncIndicator } from "~/components/SyncIndicator";
import { UserMenu } from "~/components/UserMenu";
import { isFirstSyncPending } from "~/lib/firstSync";
import { requireSession } from "~/lib/session";

// Shared by web + native. Do not export a server `loader` or `action` from /app routes.

/** Every /app screen needs a session and the local database (shared with child loaders). */
export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { user } = await requireSession(request);
  return { user };
}

/**
 * The frame around every /app screen. Its regions are fixed; later slices and
 * PRDs fill them (through the components named below), never restructure them:
 *
 * - header `group` (left): the Caretook link, then `GroupMenu` on group routes;
 * - header `sections` (wide screens): `SectionNav` on group routes;
 * - header `status`: `SyncIndicator`;
 * - header `user`: `UserMenu`;
 * - the outlet;
 * - `TabBar` (phones) under the outlet, on group routes.
 *
 * Screens outside a group (`/app`, `/app/settings`) get the header without a
 * group menu, sections or tab bar.
 */
export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { groupId } = useParams();
  const { pathname } = useLocation();
  return (
    <>
      <header className="navbar bg-base-100 gap-2 px-4 shadow-sm">
        <div data-region="group" className="flex min-w-0 flex-1 items-center gap-2">
          <Link to="/app" className="text-lg font-semibold">
            Caretook
          </Link>
          {groupId && <GroupMenu groupId={groupId} />}
        </div>
        <div data-region="sections" className="hidden items-center sm:flex">
          {groupId && <SectionNav groupId={groupId} pathname={pathname} />}
        </div>
        <div data-region="status" className="flex items-center">
          <SyncIndicator />
        </div>
        <div data-region="user" className="flex items-center">
          <UserMenu user={user} />
        </div>
      </header>
      <Outlet />
      {groupId && <TabBar groupId={groupId} pathname={pathname} />}
    </>
  );
}

// Errors inside /app (a missing group, a failed load) render here, so the
// page keeps its frame and a way back.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // A new device that hasn't got the group yet (lib/firstSync.ts).
  if (isFirstSyncPending(error)) return <FirstSyncPending />;
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-10">
      <h1 className="text-2xl font-semibold">{notFound ? "Not found" : "Something went wrong"}</h1>
      <p className="text-base-content/70">
        {notFound ? "This page doesn't exist, or you don't have access to it." : "Try again in a moment."}
      </p>
      <Link to="/app" className="btn btn-primary">
        Back to Caretook
      </Link>
    </main>
  );
}
