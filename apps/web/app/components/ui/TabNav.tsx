import type { LucideIcon } from "lucide-react";
import type { Accent } from "./accents";

import { useLayoutEffect, useRef } from "react";
import { Link, useLocation, useNavigation } from "react-router";
import { accentClass } from "./accents";

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

/**
 * The current tab: a primary-tinted section with primary text. Dark's `primary`
 * on its own tint is under 3:1, so there the text is primary lifted toward
 * white (`light-dark` follows the theme's color-scheme); see the contrast
 * test in TabNav.browser.test.tsx.
 */
const CURRENT_FILL =
  "bg-primary/15 text-[light-dark(var(--color-primary),color-mix(in_oklab,var(--color-primary)_55%,white))]";

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
 * The look: a segmented bar, fully rounded `base-100` with a soft shadow (a
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
  const currentFill = accent ? accentClass(accent, "soft") : CURRENT_FILL;
  const countBadge = accent ? `border-transparent ${accentClass(accent, "solid")}` : "badge-primary";

  // Keep the current tab in view when the bar scrolls sideways, without
  // scrolling the page (scrollIntoView would).
  useLayoutEffect(() => {
    const bar = nav.current;
    const link = bar?.children[current] as HTMLElement | undefined;
    if (!bar || !link || bar.scrollWidth <= bar.clientWidth) return;
    const start = link.offsetLeft;
    const end = start + link.offsetWidth;
    if (start < bar.scrollLeft) bar.scrollLeft = start;
    else if (end > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = end - bar.clientWidth;
  }, [current]);

  return (
    <nav
      ref={nav}
      aria-label={label}
      className={`border-[color:light-dark(transparent,var(--color-base-300))] bg-base-100 relative flex w-full max-w-full overflow-x-auto rounded-full border shadow-sm [scrollbar-width:none] sm:w-fit ${className}`}
    >
      {tabs.map((tab, index) => {
        const isCurrent = index === current;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            replace={tab.replace}
            prefetch="render"
            aria-current={isCurrent ? "page" : undefined}
            aria-label={tab.count === undefined ? undefined : `${tab.label}, ${tab.count}`}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:-outline-offset-2! first:rounded-s-full last:rounded-e-full sm:flex-none ${
              isCurrent ? currentFill : "text-base-content/80 hover:bg-base-200"
            }`}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && (
              <span aria-hidden="true" className={`badge badge-sm ${countBadge}`}>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
