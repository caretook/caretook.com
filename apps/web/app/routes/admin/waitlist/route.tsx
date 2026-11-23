import { Button } from "~/components/ui";
import { AdminPager } from "../AdminPager";
import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";

import { requireStaff } from "~/.server/admin";
import { adminUrls } from "../adminUrls";
import { WaitlistFilterForm } from "./WaitlistFilterForm";
import { WaitlistTable } from "./WaitlistTable";
import { hasFilters, pageCount, parseWaitlistSearch, waitlistSearch } from "./waitlistFilters";

// /admin/waitlist (marketing slice 5): everyone on the waitlist, newest
// first, a page at a time, filtered by when they joined, who they care for
// and where they came from, with the matching count and a CSV export of
// exactly those rows. Read-only, and only what visitors typed into the form.
// Contact messages aren't here: they go to the support inbox.

export const meta = () => [{ title: "Waitlist · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request);
  const { filter, page } = parseWaitlistSearch(new URL(request.url).search);
  const result = await api.admin.waitlist.list({ ...filter, page });
  return { ...result, filter, pages: pageCount(result.count, result.pageSize) };
}

const people = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "person" : "people"}`;

export default function Waitlist({ loaderData }: Route.ComponentProps) {
  const { filter, count, page, pages, entries } = loaderData;
  const search = waitlistSearch(filter);
  return (
    <AdminCard
      id="waitlist"
      level={1}
      title="Waitlist"
      actions={
        <Button
          href={adminUrls.waitlistExport(search)}
          download
          size="sm"
          className={count ? "" : "pointer-events-none opacity-50"}
          aria-disabled={count === 0}
          data-waitlist-export=""
        >
          Export CSV
        </Button>
      }
    >
      <WaitlistFilterForm filter={filter} />
      <p role="status" className="text-sm" data-waitlist-count={count}>
        {hasFilters(filter)
          ? `${people(count)} ${count === 1 ? "matches" : "match"}.`
          : `${people(count)} on the waitlist.`}
      </p>
      {entries.length > 0 && <WaitlistTable entries={entries} />}
      <AdminPager
        label="Waitlist pages"
        page={page}
        pages={pages}
        to={(n) => adminUrls.waitlist(waitlistSearch(filter, n))}
      />
    </AdminCard>
  );
}
