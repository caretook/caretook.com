import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PageProps = Omit<ComponentPropsWithoutRef<"main">, "children"> & {
  /** `wide` is for a page that needs more than one column's width. */
  width?: "default" | "wide";
  /**
   * A banded page (the detail pages): no column of its own; its children are
   * `Section`s, full-width bands that alternate surfaces and hold the column.
   */
  bands?: boolean;
  children: ReactNode;
};

/**
 * A page's one `main`: a centred column with the app's page padding and
 * spacing. `data-*` hooks, `id` and `className` (extra print classes) pass
 * through. A page names itself with a `PageHeader` as its first child.
 *
 * With `bands`, every child is a `Section` (the first holds the page's
 * header): the bands alternate by their rendered position, so a part that
 * renders nothing leaves no band and the rest still alternate.
 */
export function Page({ width = "default", bands = false, className = "", children, ...rest }: PageProps) {
  if (bands) {
    return (
      <main {...rest} data-bands="" className={className || undefined}>
        {children}
      </main>
    );
  }
  const max = width === "wide" ? "max-w-4xl" : "max-w-2xl";
  return (
    <main {...rest} className={`mx-auto ${max} space-y-4 px-4 py-5 ${className}`.trim()}>
      {children}
    </main>
  );
}
