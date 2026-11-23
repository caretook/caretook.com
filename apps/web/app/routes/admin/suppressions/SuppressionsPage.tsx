import { AdminPager } from "../AdminPager";
import { AdminCard } from "../AdminCard";
import type { AdminActionResult } from "../adminForms";
import type { SuppressionsData } from "./suppressionsData";

import { SUPPRESSION_QUERY_MAX } from "@caretook/data/schema";
import { Form, useFetcher } from "react-router";
import { Button, EmptyState, Field, List, ListRow, Message } from "~/components/ui";
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
    <AdminCard id="suppressions" level={1} title="Email suppressions">
      <p className="text-muted text-sm">
        After a hard bounce or a spam complaint, we stop emailing the address. Sign-in, password and
        confirmation emails still go.
      </p>
      <Form method="get" className="flex flex-wrap items-end gap-2" data-suppression-search="">
        <Field kind="input" label="Address" help="Part of it is enough." className="min-w-0 flex-1">
          {(control) => (
            <input {...control} type="search" name="q" defaultValue={q} maxLength={SUPPRESSION_QUERY_MAX} />
          )}
        </Field>
        <Button type="submit" variant="primary" className="mb-1">
          Search
        </Button>
      </Form>
      {cleared.state === "idle" && cleared.data?.ok && (
        <Message tone="success">{cleared.data.message}</Message>
      )}
      {count === 0 ? (
        <EmptyState data-suppressions-empty="">
          {q ? "No suppressed address matches." : "No suppressed addresses."}
        </EmptyState>
      ) : (
        <>
          <p className="text-sm" data-suppression-count={count}>
            {q ? `${addresses(count)} ${count === 1 ? "matches" : "match"}.` : `${addresses(count)}.`}
          </p>
          <List label="Suppressed addresses">
            {suppressions.map((s) => (
              <ListRow
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                data-suppression={s.address}
              >
                <div className="min-w-0">
                  <p className="font-medium break-all">{s.address}</p>
                  <p className="text-muted text-xs">
                    {suppressionReasonLabel(s.reason)} · {adminDay(s.createdAt)}
                  </p>
                </div>
                {canClear && <ClearSuppression address={s.address} />}
              </ListRow>
            ))}
          </List>
        </>
      )}
      <AdminPager
        label="Suppression pages"
        page={page}
        pages={pages}
        to={(n) => adminUrls.suppressions(suppressionSearch(q, n))}
      />
    </AdminCard>
  );
}
