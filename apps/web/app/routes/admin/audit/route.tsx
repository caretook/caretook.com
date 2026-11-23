import { AdminPager } from "../AdminPager";
import { AdminCard } from "../AdminCard";
import type { Route } from "./+types/route";

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
    <AdminCard id="audit" level={1} title="Audit log">
      <AuditFilterForm filter={filter} actors={actors} />
      <p role="status" className="text-sm" data-audit-count={count}>
        {hasAuditFilters(filter)
          ? `${entries(count)} ${count === 1 ? "matches" : "match"}.`
          : `${entries(count)} in the log.`}
      </p>
      {loaderData.entries.length > 0 && <AuditEntryList entries={loaderData.entries} />}
      <AdminPager
        label="Audit log pages"
        page={page}
        pages={pages}
        to={(n) => adminUrls.audit(auditSearch(filter, n))}
      />
    </AdminCard>
  );
}
