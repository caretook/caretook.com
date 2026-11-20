import type { Route } from "./+types/route";

import { Link } from "react-router";
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
    <section className="card bg-base-100 shadow-sm" aria-labelledby="waitlist">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 id="waitlist" className="card-title">
            Waitlist
          </h1>
          <a
            href={adminUrls.waitlistExport(search)}
            download
            className={`btn btn-sm ${count ? "" : "btn-disabled"}`}
            aria-disabled={count === 0}
            data-waitlist-export=""
          >
            Export CSV
          </a>
        </div>
        <WaitlistFilterForm filter={filter} />
        <p role="status" className="text-sm" data-waitlist-count={count}>
          {hasFilters(filter)
            ? `${people(count)} ${count === 1 ? "matches" : "match"}.`
            : `${people(count)} on the waitlist.`}
        </p>
        {entries.length > 0 && <WaitlistTable entries={entries} />}
        {pages > 1 && (
          <nav aria-label="Waitlist pages" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link className="btn btn-sm" to={adminUrls.waitlist(waitlistSearch(filter, page - 1))}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-sm" to={adminUrls.waitlist(waitlistSearch(filter, page + 1))}>
                Older
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
