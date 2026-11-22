import type { ReactNode } from "react";

import { TITLE_PAGE } from "./styles";

/**
 * A section page's header: its name as the `h1` on the left and an optional
 * actions node (a link, a button group, a menu) on the right, top-aligned,
 * wrapping on narrow screens. No subtitle: pages name themselves, not the
 * recipient. `description` is the one quiet line under the title (a page's
 * purpose or a viewer note). `className` is for the outer element only.
 */
export function PageHeader({
  title,
  actions,
  description,
  className = "",
}: {
  title: string;
  actions?: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      {description ? (
        <div className="min-w-0">
          <h1 className={TITLE_PAGE}>{title}</h1>
          <p className="text-muted text-sm">{description}</p>
        </div>
      ) : (
        <h1 className={`min-w-0 ${TITLE_PAGE}`}>{title}</h1>
      )}
      {actions != null && actions !== false && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{actions}</div>
      )}
    </header>
  );
}
