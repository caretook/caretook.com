import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useId } from "react";
import { TITLE_SECTION } from "./styles";

type SectionProps = Omit<ComponentPropsWithoutRef<"section">, "title" | "id"> & {
  /** The band's heading (an `h2`); with it the band is a `section` named by it. */
  title?: string;
  /** The `data-section` hook. */
  id?: string;
  /** Beside the heading, at the end (an Add link, a small button). */
  actions?: ReactNode;
  /** One quiet line under the heading. */
  description?: ReactNode;
  children?: ReactNode;
};

/**
 * One band of a banded `Page`: the window's full width, its surface
 * alternating `base-200` and `base-100` from the first band by its rendered
 * position, a `base-300` rule above all but the first, and the content in
 * the page's column. With a `title` (or an `aria-label`) it is a `section`
 * named by it, else a plain `div`. A page's part component renders a
 * `Section` itself (and nothing when it has nothing to show), never a
 * wrapper around one. No cards inside a band; a list keeps its box.
 */
export function Section({
  title,
  id,
  actions,
  description,
  className = "",
  children,
  ...rest
}: SectionProps) {
  const headingId = useId();
  const named = !!title || !!rest["aria-label"];
  const Tag = named ? "section" : "div";
  const heading = title && (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h2 id={headingId} className={TITLE_SECTION}>
          {title}
        </h2>
        {description != null && description !== false && <p className="text-muted text-sm">{description}</p>}
      </div>
      {actions != null && actions !== false && (
        <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div>
      )}
    </div>
  );
  return (
    <Tag
      aria-labelledby={title ? headingId : undefined}
      data-section={id}
      {...rest}
      data-band=""
      className={`border-base-300 odd:bg-base-200 even:bg-base-100 py-6 not-first:border-t ${className}`.trim()}
    >
      <div className="mx-auto max-w-2xl space-y-2 px-4">
        {heading}
        {children}
      </div>
    </Tag>
  );
}
