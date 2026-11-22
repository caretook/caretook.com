import type { ReactNode } from "react";
import type { To } from "react-router";

import { Link } from "react-router";

/** The row's one padding. */
const ROW = "px-3 py-3";
/** A link row: a quiet fill on hover, a little deeper while its link is pressed (not a trailing control), faded in with the kit's motion. */
const LINK_ROW = "motion-colors hover:bg-base-200 has-[>a:active]:bg-base-300/60 relative";
/** A link stretched over its row (the screens' pattern), with its focus ring on the row. */
const STRETCHED =
  "min-w-0 flex-1 outline-none before:absolute before:inset-0 focus-visible:before:outline-2 focus-visible:before:-outline-offset-2";

type DataHooks = { [attr: `data-${string}`]: string | undefined };

/**
 * One bordered, divided box of rows (`base-300` border and dividers), a `ul`
 * of `ListRow`s. `label` names it when nothing on the page does; `data-*`
 * hooks and `className` (a margin) go on the `ul`.
 */
export function List({
  label,
  className = "",
  children,
  ...data
}: {
  label?: string;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  children: ReactNode;
} & DataHooks) {
  return (
    <ul
      {...data}
      aria-label={label}
      className={`rounded-box border-base-300 divide-base-300 bg-base-100 divide-y overflow-hidden border ${className}`.trim()}
    >
      {children}
    </ul>
  );
}

/**
 * A row of a `List`, with the row's one padding. With `to` the row is one
 * link (stretched over the row, named by `children`); `trailing` (a button,
 * a switch, a badge) sits at the end and stays its own control. Without
 * either, `children` is the row's whole content. A link row fills on hover
 * and press (`motion-colors`; at once under "reduce motion"). `data-*` hooks and
 * `className` (the row's own stacking, a `space-y-*`) go on the `li`.
 */
export function ListRow({
  to,
  trailing,
  className = "",
  children,
  ...data
}: {
  to?: To;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
} & DataHooks) {
  if (to === undefined && !trailing)
    return (
      <li {...data} className={`${ROW} ${className}`.trim()}>
        {children}
      </li>
    );
  const end = trailing && <div className="relative z-10 flex shrink-0 items-center gap-2">{trailing}</div>;
  return (
    <li
      {...data}
      className={`${ROW} flex items-center gap-3 ${to === undefined ? "" : LINK_ROW} ${className}`.trim()}
    >
      {to === undefined ? (
        <div className="min-w-0 flex-1">{children}</div>
      ) : (
        <Link to={to} className={STRETCHED}>
          {children}
        </Link>
      )}
      {end}
    </li>
  );
}
