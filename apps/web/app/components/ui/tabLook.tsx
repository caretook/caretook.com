import type { LucideIcon } from "lucide-react";
import type { Accent } from "./accents";

import { CircleAlert } from "lucide-react";
import { accentClass } from "./accents";

// The one tabs look, shared by `TabNav` (page tabs: links in a nav) and
// `FormTabs` (form tabs: a tablist whose panels switch in place). Only the
// behaviour differs; the bar, the sections, the current fill, the icon, the
// count and the markers are drawn here.

/**
 * The current tab: a primary-tinted section with primary text. Dark's `primary`
 * on its own tint is under 3:1, so there the text is primary lifted toward
 * white (`light-dark` follows the theme's color-scheme); see the contrast
 * test in TabNav.browser.test.tsx.
 */
const CURRENT_FILL =
  "bg-primary/15 text-[light-dark(var(--color-primary),color-mix(in_oklab,var(--color-primary)_55%,white))]";

/**
 * The bar: a segmented, fully rounded `base-100` bar with a soft shadow (a
 * faint border in dark). Full width on phones, fit to its tabs from `sm`;
 * when the tabs don't fit it scrolls sideways (the page doesn't).
 */
export const TAB_BAR =
  "border-[color:light-dark(transparent,var(--color-base-300))] bg-base-100 relative flex w-full max-w-full overflow-x-auto rounded-full border shadow-sm [scrollbar-width:none] sm:w-fit";

/**
 * One tab's section: edge to edge with its neighbours, the bar's full 44 px
 * height, so the current tint and a hover fill the whole section, clipped by
 * the bar's rounded ends (the end tabs round with them, so the focus ring,
 * drawn inside, follows the curve). Equal tabs on phones.
 */
export function tabClass(current: boolean, accent?: Accent) {
  const fill = accent ? accentClass(accent, "soft") : CURRENT_FILL;
  return `flex min-h-11 flex-1 items-center justify-center gap-1.5 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:-outline-offset-2! first:rounded-s-full last:rounded-e-full sm:flex-none ${
    current ? fill : "text-base-content/80 hover:bg-base-200"
  }`;
}

/** What a tab shows besides its label. */
export type TabParts = {
  label: string;
  /** An icon before the label (decorative: hidden from the accessible name). */
  icon?: LucideIcon;
  /** A count after the label, a small badge, read as part of the name ("List, 12"). */
  count?: number;
  /** Form tabs: a dot saying the tab's fields hold something (read as "filled in"). */
  hasContent?: boolean;
  /** Form tabs: an alert icon saying a field on the tab has an error (read as "has an error"). */
  error?: boolean;
};

/**
 * The tab's accessible name when it shows more than its label ("List, 12",
 * "Details, filled in, has an error"), else undefined (the label names it).
 */
export function tabName({ label, count, hasContent, error }: TabParts) {
  const extras = [
    count === undefined ? undefined : String(count),
    hasContent ? "filled in" : undefined,
    error ? "has an error" : undefined,
  ].filter((part) => part !== undefined);
  return extras.length ? [label, ...extras].join(", ") : undefined;
}

/** A tab's insides: icon, label, count, then the content and error markers. */
export function TabContent({
  label,
  icon: Icon,
  count,
  hasContent,
  error,
  accent,
}: TabParts & { accent?: Accent }) {
  const countBadge = accent ? `border-transparent ${accentClass(accent, "solid")}` : "badge-primary";
  return (
    <>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {label}
      {count !== undefined && (
        <span aria-hidden="true" className={`badge badge-sm ${countBadge}`}>
          {count}
        </span>
      )}
      {hasContent && !error && (
        <span
          aria-hidden="true"
          data-tab-marker="content"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {error && (
        <CircleAlert aria-hidden="true" data-tab-marker="error" className="text-error size-4 shrink-0" />
      )}
    </>
  );
}

/**
 * Keeps the tab at `index` in view when the bar scrolls sideways, without
 * scrolling the page (scrollIntoView would). Call it from a layout effect.
 */
export function keepTabInView(bar: HTMLElement | null, index: number) {
  const tab = bar?.children[index] as HTMLElement | undefined;
  if (!bar || !tab || bar.scrollWidth <= bar.clientWidth) return;
  const start = tab.offsetLeft;
  const end = start + tab.offsetWidth;
  if (start < bar.scrollLeft) bar.scrollLeft = start;
  else if (end > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = end - bar.clientWidth;
}
