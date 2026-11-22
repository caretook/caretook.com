import type { ReactNode } from "react";

import { useId } from "react";
import { TITLE_SECTION } from "./styles";

/** The card's surface and its one body gap. */
const CARD = "card bg-base-100 shadow-sm";
const BODY = "card-body gap-3";

/**
 * A surface on the page (`base-100` on the `base-200` page) with one body gap.
 * With a `title` it's a region of its own: a `section` named by its heading
 * (section-title size), with `data-section={id}` and `actions` (buttons beside
 * the title). Without one it's a plain card. `data-*` hooks and `className` (a
 * margin) go on the outer element.
 */
export function Card({
  id,
  title,
  headingId,
  actions,
  className = "",
  children,
  ...data
}: {
  /** The `data-section` hook of a titled card. */
  id?: string;
  title?: ReactNode;
  /** The heading's id, for a control on the card named by it; one of its own by default. */
  headingId?: string;
  /** Controls beside the title (a titled card only). */
  actions?: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  children: ReactNode;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  const ownId = useId();
  const heading = headingId ?? ownId;
  const outer = `${CARD} ${className}`.trim();
  if (!title)
    return (
      <div {...data} className={outer}>
        <div className={BODY}>{children}</div>
      </div>
    );
  const titleEl = (
    <h2 id={heading} className={TITLE_SECTION}>
      {title}
    </h2>
  );
  return (
    <section {...data} aria-labelledby={heading} data-section={id} className={outer}>
      <div className={BODY}>
        {actions ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {titleEl}
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        ) : (
          titleEl
        )}
        {children}
      </div>
    </section>
  );
}
