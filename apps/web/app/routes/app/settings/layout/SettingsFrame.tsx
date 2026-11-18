import type { SettingsItem } from "./settingsNav";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { isSettingsList, SETTINGS_WIDE_QUERY, settingsCurrent } from "./settingsNav";

/**
 * A settings area: its list of subpages and the open subpage (the `Outlet`).
 *
 * - Phones: the list's own page shows only the list; a subpage shows only
 *   itself, under a back link to the list.
 * - Wide screens (`md`, `SETTINGS_WIDE_QUERY`): the list is a side nav beside
 *   the open subpage, and the list's own page opens the first subpage
 *   (`isWideSettings` in the index's loader, and `useWideSettingsRedirect`
 *   here when the window widens on the list).
 *
 * The current item has `aria-current="page"`. One nav serves both widths, so
 * screen readers meet it once.
 */
export function SettingsFrame({
  title,
  listPath,
  items,
}: {
  title: string;
  listPath: string;
  items: readonly SettingsItem[];
}) {
  const { pathname } = useLocation();
  const atList = isSettingsList(pathname, listPath);
  useWideSettingsRedirect(atList ? items[0]?.path : undefined);
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 md:flex md:items-start md:gap-8">
      <nav
        aria-label={title}
        data-settings-nav
        className={`${atList ? "" : "hidden md:block"} md:w-56 md:shrink-0`}
      >
        {atList ? (
          <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
        ) : (
          <p className="text-base-content/70 mb-2 hidden px-3 text-sm font-semibold md:block">{title}</p>
        )}
        <ul className="rounded-box bg-base-100 divide-base-200 divide-y shadow-sm md:divide-y-0 md:bg-transparent md:shadow-none">
          {items.map((item) => {
            const current = settingsCurrent(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Link
                  to={item.path}
                  aria-current={current}
                  data-settings-item={item.id}
                  className={`flex items-center gap-3 px-4 py-3 md:rounded-field md:px-3 md:py-2 ${
                    current ? "md:bg-base-200 font-semibold" : "md:hover:bg-base-200"
                  }`}
                >
                  <Icon aria-hidden="true" className="text-base-content/70 size-5 shrink-0 md:size-4" />
                  <span className="min-w-0 flex-1">
                    <span className="block">{item.label}</span>
                    <span className="text-base-content/70 block text-sm font-normal md:hidden">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="text-base-content/50 size-4 md:hidden" />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {!atList && (
        <div className="min-w-0 flex-1 space-y-4">
          <Link to={listPath} className="btn btn-ghost btn-sm -ml-2 gap-1 md:hidden">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {title}
          </Link>
          <Outlet />
        </div>
      )}
    </main>
  );
}

/** Whether the window is wide enough for the side nav (always false off the client). */
export const isWideSettings = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(SETTINGS_WIDE_QUERY).matches
    : false;

/**
 * On the list's own page (`firstPath` set), open `firstPath` (replacing the
 * list in history) when the window is or becomes as wide as the side nav, so
 * a wide screen never shows the list with nothing beside it.
 */
function useWideSettingsRedirect(firstPath: string | undefined) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!firstPath) return;
    const query = window.matchMedia(SETTINGS_WIDE_QUERY);
    const follow = () => {
      if (query.matches) void navigate(firstPath, { replace: true });
    };
    follow();
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [navigate, firstPath]);
}
