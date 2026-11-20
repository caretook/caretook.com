import type { Route } from "./+types/route";

import { Link } from "react-router";
import { requireStaff } from "~/.server/admin";
import { adminUrls } from "../adminUrls";
import { AuditEntryList } from "../AuditEntryList";
import { auditPageCount, auditSearch, hasAuditFilters, parseAuditSearch } from "../auditFilters";
import { AuditFilterForm } from "./AuditFilterForm";

// /admin/audit (admin PRD): every staff action, newest first, 50 a page,
// filtered by staff member, account or group, action and day (all in the
// URL). Every staff member reads it; nobody can change it.

export const meta = () => [{ title: "Audit log · Caretook admin" }, { name: "robots", content: "noindex" }];

export async function loader({ request }: Route.LoaderArgs) {
  const { api } = await requireStaff(request, "audit.read");
  const { filter, page } = parseAuditSearch(new URL(request.url).search);
  const result = await api.admin.audit.list({ ...filter, page });
  return { ...result, filter, pages: auditPageCount(result.count, result.pageSize) };
}

const entries = (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "entry" : "entries"}`;

export default function Audit({ loaderData }: Route.ComponentProps) {
  const { filter, count, page, pages, actors } = loaderData;
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="audit">
      <div className="card-body gap-4">
        <h1 id="audit" className="card-title">
          Audit log
        </h1>
        <AuditFilterForm filter={filter} actors={actors} />
        <p role="status" className="text-sm" data-audit-count={count}>
          {hasAuditFilters(filter)
            ? `${entries(count)} ${count === 1 ? "matches" : "match"}.`
            : `${entries(count)} in the log.`}
        </p>
        {loaderData.entries.length > 0 && <AuditEntryList entries={loaderData.entries} />}
        {pages > 1 && (
          <nav aria-label="Audit log pages" className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link className="btn btn-sm" to={adminUrls.audit(auditSearch(filter, page - 1))}>
                Newer
              </Link>
            ) : (
              <span />
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link className="btn btn-sm" to={adminUrls.audit(auditSearch(filter, page + 1))}>
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
