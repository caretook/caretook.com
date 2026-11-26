import type { LucideIcon } from "lucide-react";
import type { Accent } from "./accents";

import { useLayoutEffect, useRef } from "react";
import { Link, useLocation, useNavigation } from "react-router";
import { keepTabInView, TAB_BAR, TabContent, tabClass, tabName } from "./tabLook";

export type TabNavTab = {
  label: string;
  /** The tab's URL. */
  to: string;
  /**
   * Which pathnames count as this tab. By default, its own pathname and any
   * path under it (a sheet opened over it); a `match` replaces that.
   */
  match?: (pathname: string) => boolean;
  /**
   * Whether this is the current tab, overriding the path match: for tabs
   * told apart by something other than their path (a search parameter).
   */
  current?: boolean;
  /** An icon before the label (decorative: hidden from the accessible name). */
  icon?: LucideIcon;
  /** A count after the label, a small badge, read as part of the name ("List, 12"). */
  count?: number;
  /** Replace the history entry instead of adding one. */
  replace?: boolean;
};

const pathOf = (to: string) => to.split(/[?#]/, 1)[0]!.replace(/\/+$/, "");

const claims = (tab: TabNavTab, pathname: string) => {
  if (tab.current !== undefined) return tab.current;
  if (tab.match) return tab.match(pathname);
  const own = pathOf(tab.to);
  return pathname === own || pathname.startsWith(`${own}/`);
};

/**
 * A page's tabs, when each tab has its own URL: links in a `nav` named
 * `label`, not an ARIA tablist (switching tabs is navigation). The current
 * tab (the first that claims the path, or says it's `current`) has
 * `aria-current="page"`, taken from the pending navigation so a tap marks it
 * at once, before its loader finishes; a cancelled navigation falls back to
 * the current path. Links prefetch on render, so a switch works offline.
 *
 * The look (shared with `FormTabs`, in `tabLook.tsx`): a segmented bar, fully rounded `base-100` with a soft shadow (a
 * faint border in dark), plain labels. The tabs sit edge to edge with no
 * inset or gap, each the bar's full 44 px height, so the current tab's tint
 * and a hover fill the whole section, clipped by the bar's rounded ends (the
 * end tabs round with them, so the focus ring, drawn inside the tab, follows
 * the curve). Full width with equal tabs on phones, fit to its tabs from `sm`;
 * when the tabs don't fit it scrolls sideways (the page doesn't), keeping the
 * current tab in view. `accent` puts the current section and the counts in a
 * section's colour instead of primary. `className` is for the outer element
 * only.
 */
export function TabNav({
  label,
  tabs,
  accent,
  className = "",
}: {
  label: string;
  tabs: readonly TabNavTab[];
  accent?: Accent;
  className?: string;
}) {
  const { pathname } = useLocation();
  const target = useNavigation().location?.pathname ?? pathname;
  const current = tabs.findIndex((tab) => claims(tab, target));
  const nav = useRef<HTMLElement>(null);
  // Keep the current tab in view when the bar scrolls sideways.
  useLayoutEffect(() => keepTabInView(nav.current, current), [current]);

  return (
    <nav ref={nav} aria-label={label} className={`${TAB_BAR} ${className}`}>
      {tabs.map((tab, index) => (
        <Link
          key={tab.to}
          to={tab.to}
          replace={tab.replace}
          prefetch="render"
          aria-current={index === current ? "page" : undefined}
          aria-label={tabName(tab)}
          className={tabClass(index === current, accent)}
        >
          <TabContent label={tab.label} icon={tab.icon} count={tab.count} accent={accent} />
        </Link>
      ))}
    </nav>
  );
}
