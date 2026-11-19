import type { AuditAction, AuditChanges } from "@caretook/data/schema";

import { Link } from "react-router";
import { adminUrls } from "./adminUrls";
import { actionLabel, actorLabel, auditTime, changeLines, targetLabel } from "./auditDisplay";
import { auditSearch } from "./auditFilters";

// Audit entries as a list (it reads on a phone, unlike a wide table): when,
// who, what, on whom, why and what changed. Shared by /admin/audit and the
// account and group pages. The target links to everything about it.

type Person = { id: string; name: string | null; email: string | null };

export type AuditEntryView = {
  id: string;
  action: AuditAction;
  actor: Person | null;
  targetUser: Person | null;
  targetGroup: { id: string; name: string | null } | null;
  reason: string | null;
  changes: AuditChanges;
  createdAt: string;
};

export function AuditEntryList({ entries }: { entries: readonly AuditEntryView[] }) {
  return (
    <ol className="divide-base-300 divide-y" data-audit-entries="">
      {entries.map((entry) => {
        const targetId = entry.targetUser?.id ?? entry.targetGroup?.id;
        const target = targetLabel(entry);
        const lines = changeLines(entry.changes);
        return (
          <li
            key={entry.id}
            className="space-y-1 py-3 text-sm"
            data-audit-entry={entry.id}
            data-action={entry.action}
            data-actor={entry.actor?.email ?? "system"}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-medium">{actionLabel(entry.action)}</span>
              <time dateTime={entry.createdAt} className="text-base-content/70 text-xs">
                {auditTime(entry.createdAt)}
              </time>
            </div>
            <p>
              By <span data-audit-actor="">{actorLabel(entry.actor)}</span>
              {target && targetId && (
                <>
                  {" · "}
                  <Link className="link" to={adminUrls.audit(auditSearch({ target: targetId }))}>
                    {target}
                  </Link>
                </>
              )}
            </p>
            {entry.reason && <p className="text-base-content/80">Reason: {entry.reason}</p>}
            {lines.length > 0 && (
              <ul className="text-base-content/80 font-mono text-xs break-all">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
