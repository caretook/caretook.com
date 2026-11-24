import type { To } from "react-router";

import { Button } from "~/components/ui";

// Newer and Older under an /admin list, with where you are. Nothing for one page.

export function AdminPager({
  label,
  page,
  pages,
  to,
}: {
  /** The `nav`'s name ("Audit log pages"). */
  label: string;
  page: number;
  pages: number;
  to: (page: number) => To;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2 text-sm">
      {page > 1 ? (
        <Button to={to(page - 1)} size="sm">
          Newer
        </Button>
      ) : (
        <span />
      )}
      <span>
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Button to={to(page + 1)} size="sm">
          Older
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
