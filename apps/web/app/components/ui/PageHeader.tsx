import type { ReactNode } from "react";

/**
 * A section page's header: its name as the `h1` on the left and an optional
 * actions node (a link, a button group, a menu) on the right, top-aligned,
 * wrapping on narrow screens. No subtitle: pages name themselves, not the
 * recipient. `className` is for the outer element only.
 */
export function PageHeader({
  title,
  actions,
  className = "",
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <h1 className="min-w-0 text-lg font-semibold">{title}</h1>
      {actions != null && actions !== false && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{actions}</div>
      )}
    </header>
  );
}
