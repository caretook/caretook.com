import type { Route } from "./+types/route";

import { NavLink, Outlet } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminSections } from "../adminSections";

// /admin: Caretook staff only (admin and support; web only, server loaders).
// Anyone else, a group's owner included, gets a 404. Each staff member sees
// the sections their role allows (adminSections), and never a group's care
// data.

export const meta = () => [{ title: "Admin · Caretook" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { capabilities } = await requireStaff(request);
  return { capabilities };
}

const tab = ({ isActive }: { isActive: boolean }) => `tab shrink-0 ${isActive ? "tab-active" : ""}`;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const sections = adminSections(loaderData.capabilities);
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
        {/* Scrolls sideways on phones rather than wrapping. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <nav aria-label="Admin sections" className="tabs tabs-box w-max flex-nowrap" data-admin-nav="">
            {sections.map((section) => (
              <NavLink key={section.id} to={section.path()} className={tab} data-section={section.id}>
                {section.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
