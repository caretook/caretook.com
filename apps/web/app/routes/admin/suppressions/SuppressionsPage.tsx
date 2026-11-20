import type { AdminActionResult } from "../adminForms";
import type { SuppressionsData } from "./suppressionsData";

import { SUPPRESSION_QUERY_MAX } from "@caretook/data/schema";
import { Form, Link, useFetcher } from "react-router";
import { Field } from "~/components/ui";
import { adminDay } from "../accountDisplay";
import { adminUrls } from "../adminUrls";
import { CLEAR_FETCHER, ClearSuppression } from "./ClearSuppression";
import { suppressionReasonLabel, suppressionSearch } from "./suppressionSearch";

// /admin/suppressions: the addresses we no longer email after a hard bounce
// or a spam complaint, newest first, searched by part of an address (in the
// URL). Staff with `users.help` can clear one. Sign-in email still goes to
// a suppressed address.

const addresses = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "address" : "addresses"}`;

export function SuppressionsPage({ data }: { data: SuppressionsData }) {
  const { q, count, page, pages, suppressions, canClear } = data;
  const cleared = useFetcher<AdminActionResult>({ key: CLEAR_FETCHER });
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="suppressions">
      <div className="card-body gap-4">
        <h1 id="suppressions" className="card-title">
          Email suppressions
        </h1>
        <p className="text-base-content/80 text-sm">
          After a hard bounce or a spam complaint, we stop emailing the address. Sign-in, password and
          confirmation emails still go.
        </p>
        <Form method="get" className="flex flex-wrap items-end gap-2" data-suppression-search="">
          <Field label="Address" help="Part of it is enough." className="min-w-0 flex-1">
            {(control) => (
              <input
                {...control}
                type="search"
                name="q"
                defaultValue={q}
                maxLength={SUPPRESSION_QUERY_MAX}
                className="input w-full"
              />
            )}
          </Field>
          <button type="submit" className="btn btn-primary mb-1">
            Search
          </button>
        </Form>
        {cleared.state === "idle" && cleared.data?.ok && (
          <p role="status" className="text-success text-sm">
            {cleared.data.message}
          </p>
        )}
        {count === 0 ? (
          <p className="text-sm" data-suppressions-empty="">
            {q ? "No suppressed address matches." : "No suppressed addresses."}
          </p>
        ) : (
          <>
            <p className="text-sm" data-suppression-count={count}>
              {q ? `${addresses(count)} ${count === 1 ? "matches" : "match"}.` : `${addresses(count)}.`}
            </p>
            <ul className="divide-base-300 divide-y" aria-label="Suppressed addresses">
              {suppressions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                  data-suppression={s.address}
                >
                  <div className="min-w-0">
                    <p className="font-medium break-all">{s.address}</p>
                    <p className="text-base-content/70 text-xs">
                      {suppressionReasonLabel(s.reason)} · {adminDay(s.createdAt)}
                    </p>
                  </div>
                  {canClear && <ClearSuppression address={s.address} />}
                </li>
              ))}
            </ul>
          </>
        )}
        {pages > 1 && (
          <nav aria-label="Suppression pages" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link className="btn btn-sm" to={adminUrls.suppressions(suppressionSearch(q, page - 1))}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-sm" to={adminUrls.suppressions(suppressionSearch(q, page + 1))}>
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
