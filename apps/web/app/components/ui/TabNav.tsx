import { Link, useLocation, useNavigation } from "react-router";

export type TabNavTab = {
  label: string;
  /** The tab's URL. */
  to: string;
  /**
   * Which pathnames count as this tab. By default, its own pathname and any
   * path under it (a sheet opened over it); a `match` replaces that.
   */
  match?: (pathname: string) => boolean;
};

const pathOf = (to: string) => to.split(/[?#]/, 1)[0]!.replace(/\/+$/, "");

const claims = (tab: TabNavTab, pathname: string) => {
  if (tab.match) return tab.match(pathname);
  const own = pathOf(tab.to);
  return pathname === own || pathname.startsWith(`${own}/`);
};

/**
 * A page's tabs, when each tab has its own URL: links in a `nav` named
 * `label`, not an ARIA tablist (switching tabs is navigation). The current
 * tab (the first that claims the path) has `aria-current="page"`, taken from
 * the pending navigation so a tap marks it at once, before its loader
 * finishes; a cancelled navigation falls back to the current path. Links
 * prefetch on render, so a switch works offline. A segmented daisyUI
 * `tabs-box`, full width on phones. `className` is for the outer element only.
 */
export function TabNav({
  label,
  tabs,
  className = "",
}: {
  label: string;
  tabs: readonly TabNavTab[];
  className?: string;
}) {
  const { pathname } = useLocation();
  const target = useNavigation().location?.pathname ?? pathname;
  const current = tabs.findIndex((tab) => claims(tab, target));
  return (
    <nav aria-label={label} className={`tabs tabs-box w-full flex-nowrap sm:w-fit ${className}`}>
      {tabs.map((tab, index) => (
        <Link
          key={tab.to}
          to={tab.to}
          prefetch="render"
          aria-current={index === current ? "page" : undefined}
          className={`tab flex-1 whitespace-nowrap sm:flex-none ${index === current ? "tab-active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
