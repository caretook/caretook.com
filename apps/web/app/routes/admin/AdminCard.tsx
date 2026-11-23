import type { ReactNode } from "react";

import { Card, TITLE_SECTION } from "~/components/ui";

// One card of an /admin page: a region named by its heading. `/admin` keeps its
// own heading sizes (a page's `h1` and most titles `lg`; an account's sections
// `base`), so this wraps `Card` rather than using its `h2` title.

const TITLE_ADMIN = "text-lg font-semibold";

export function AdminCard({
  id,
  title,
  level = 2,
  titleSize = "lg",
  titleClassName = "",
  actions,
  children,
  ...data
}: {
  /** The heading's id, which names the region. */
  id: string;
  title: ReactNode;
  level?: 1 | 2;
  titleSize?: "lg" | "base";
  /** Extra classes for the heading (`break-all` for an address). */
  titleClassName?: string;
  /** Controls beside the title. */
  actions?: ReactNode;
  children: ReactNode;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  const heading = (
    <Heading
      id={id}
      className={`${titleSize === "lg" ? TITLE_ADMIN : TITLE_SECTION} ${titleClassName}`.trim()}
    >
      {title}
    </Heading>
  );
  return (
    <section {...data} aria-labelledby={id}>
      <Card>
        {actions ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            {heading}
            {actions}
          </div>
        ) : (
          heading
        )}
        {children}
      </Card>
    </section>
  );
}
