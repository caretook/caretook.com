import type { Route } from "./+types/route";

import { NavLink, Outlet } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminUrls } from "../adminUrls";

// /admin: Caretook staff only (the global `admin` role; web only, server
// loaders). Anyone else, a group's owner included, gets a 404. Staff see
// access codes, the groups they set up and the waitlist, never a group's care data.

export const meta = () => [{ title: "Admin · Caretook" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireStaff(request);
  return null;
}

const tab = ({ isActive }: { isActive: boolean }) => `tab ${isActive ? "tab-active" : ""}`;

export default function AdminLayout() {
  return (
    <div className="bg-base-200 min-h-dvh">
      <header className="border-base-300 bg-base-100 border-b px-4 sm:px-6">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4">
          <span className="font-semibold">Caretook admin</span>
          <a href="/app" className="link text-sm">
            Back to the app
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <nav aria-label="Admin sections" className="tabs tabs-box w-fit">
          <NavLink to={adminUrls.accessCodes()} className={tab}>
            Access codes
          </NavLink>
          <NavLink to={adminUrls.newGroup()} className={tab}>
            New group
          </NavLink>
          <NavLink to={adminUrls.waitlist()} className={tab}>
            Waitlist
          </NavLink>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
