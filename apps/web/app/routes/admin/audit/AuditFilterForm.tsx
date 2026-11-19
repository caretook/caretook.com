import type { AuditFilterValues } from "../auditFilters";

import { AUDIT_ACTIONS } from "@caretook/data/schema";
import { Form, Link } from "react-router";
import { Field } from "~/components/ui";
import { adminUrls } from "../adminUrls";
import { actionLabel } from "../auditDisplay";
import { hasAuditFilters } from "../auditFilters";

// The audit log's filters: a GET form, so they live in the URL.

type Actor = { id: string; name: string | null; email: string };

export function AuditFilterForm({ filter, actors }: { filter: AuditFilterValues; actors: readonly Actor[] }) {
  return (
    <Form method="get" className="grid items-end gap-x-4 sm:grid-cols-3" data-audit-filters="">
      <Field label="Staff member">
        {(control) => (
          <select {...control} name="actor" defaultValue={filter.actorId ?? ""} className="select w-full">
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ? `${a.name} (${a.email})` : a.email}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Account or group" help="Part of an email, a name, or an id.">
        {(control) => (
          <input
            {...control}
            type="search"
            name="target"
            defaultValue={filter.target}
            maxLength={254}
            className="input w-full"
          />
        )}
      </Field>
      <Field label="Action">
        {(control) => (
          <select {...control} name="action" defaultValue={filter.action ?? ""} className="select w-full">
            <option value="">Any action</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="From">
        {(control) => (
          <input {...control} type="date" name="from" defaultValue={filter.from} className="input w-full" />
        )}
      </Field>
      <Field label="To">
        {(control) => (
          <input {...control} type="date" name="to" defaultValue={filter.to} className="input w-full" />
        )}
      </Field>
      <div className="flex gap-2 pb-2">
        <button type="submit" className="btn btn-primary">
          Filter
        </button>
        {hasAuditFilters(filter) && (
          <Link to={adminUrls.audit()} className="btn btn-ghost">
            Clear
          </Link>
        )}
      </div>
    </Form>
  );
}
