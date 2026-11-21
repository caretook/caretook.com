import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PageProps = Omit<ComponentPropsWithoutRef<"main">, "children"> & {
  /** `wide` is for a page that needs more than one column's width. */
  width?: "default" | "wide";
  children: ReactNode;
};

/**
 * A page's one `main`: a centred column with the app's page padding and
 * spacing. `data-*` hooks, `id` and `className` (extra print classes) pass
 * through. A page names itself with a `PageHeader` as its first child.
 */
export function Page({ width = "default", className = "", children, ...rest }: PageProps) {
  const max = width === "wide" ? "max-w-4xl" : "max-w-2xl";
  return (
    <main {...rest} className={`mx-auto ${max} space-y-4 px-4 py-5 ${className}`.trim()}>
      {children}
    </main>
  );
}
