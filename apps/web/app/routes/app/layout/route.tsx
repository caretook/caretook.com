import type { Route } from "./+types/route";

import { isRouteErrorResponse, Link, Outlet, useLocation, useParams } from "react-router";
import { Search } from "lucide-react";
import { Wordmark } from "~/components/brand";
import { FirstSyncPending } from "~/components/shell";
import { IconButton } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { isFirstSyncPending } from "~/lib/firstSync";
import { requireSession, sessionContext } from "~/lib/session";
import { Announcement } from "./Announcement";
import { GroupMenu } from "./GroupMenu";
import { SectionNav, TabBar } from "./SectionNav";
import { SyncIndicator } from "./SyncIndicator";
import { useSimpleFrame } from "./useSimpleFrame";
import { UserMenu } from "./UserMenu";

// Shared by web + native. Do not export a server `loader` or `action` from /app routes.

/**
 * Every /app screen needs a session and the local database: checked once per
 * navigation (or sign-in), then read by every loader, action and middleware
 * below as `context.get(sessionContext)`.
 */
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(sessionContext, await requireSession(request));
  },
];

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  return { user };
}

/**
 * The frame around every /app screen. Its regions are fixed; later slices and
 * PRDs fill them (through the components named below), never restructure them:
 *
 * - header `group` (left): the Caretook link, then `GroupMenu` on group routes;
 * - header `sections` (wide screens): `SectionNav` on group routes;
 * - header `search`: the magnifier that opens the group's search, on group routes;
 * - header `status`: `SyncIndicator`;
 * - header `user`: `UserMenu`;
 * - `announcement`: staff's banner (`Announcement`), when there is one;
 * - the outlet;
 * - `TabBar` (phones) under the outlet, on group routes.
 *
 * Screens outside a group (`/app`, `/app/settings`) get the header without a
 * group menu, sections or tab bar. So does a timeline in simple mode
 * (`useSimpleFrame`), which also has no search and a reduced user menu.
 */
export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const { groupId } = useParams();
  const { pathname } = useLocation();
  // Simple mode's timeline: only the mark, the sync status and a reduced user menu.
  const simple = useSimpleFrame(user.id, groupId, pathname);
  const groupFrame = groupId && !simple ? groupId : undefined;
  return (
    <>
      <header className="navbar h-16 min-h-16 gap-2 border-b border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-6 print:hidden">
        <div data-region="group" className="flex min-w-0 flex-1 items-center gap-2">
          <Link to={appUrls.home()} className="shrink-0 rounded-field">
            <Wordmark wordHiddenBelow={groupId ? "sm" : undefined} />
          </Link>
          {groupFrame && <GroupMenu groupId={groupFrame} />}
        </div>
        <div data-region="sections" className="hidden items-center sm:flex">
          {groupFrame && <SectionNav groupId={groupFrame} pathname={pathname} />}
        </div>
        {groupFrame && (
          <div data-region="search" className="flex items-center">
            <IconButton to={appUrls.search(groupFrame)} icon={Search} label="Search this care group" />
          </div>
        )}
        <div data-region="status" className="flex items-center">
          <SyncIndicator />
        </div>
        <div data-region="user" className="flex items-center">
          <UserMenu user={user} simple={simple} />
        </div>
      </header>
      <div data-region="announcement" className="print:hidden">
        <Announcement pathname={pathname} />
      </div>
      <Outlet />
      {groupFrame && <TabBar groupId={groupFrame} pathname={pathname} />}
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
      <Link to={appUrls.home()} className="btn btn-primary">
        Back to Caretook
      </Link>
    </main>
  );
}
