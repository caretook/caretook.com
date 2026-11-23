import type { AuditFilterValues } from "../auditFilters";

import { AUDIT_ACTIONS } from "@caretook/data/schema";
import { Form } from "react-router";
import { Button, Field } from "~/components/ui";
import { adminUrls } from "../adminUrls";
import { actionLabel } from "../auditDisplay";
import { hasAuditFilters } from "../auditFilters";

// The audit log's filters: a GET form, so they live in the URL.

type Actor = { id: string; name: string | null; email: string };

export function AuditFilterForm({ filter, actors }: { filter: AuditFilterValues; actors: readonly Actor[] }) {
  return (
    <Form method="get" className="grid items-end gap-x-4 sm:grid-cols-3" data-audit-filters="">
      <Field kind="select" label="Staff member">
        {(control) => (
          <select {...control} name="actor" defaultValue={filter.actorId ?? ""}>
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ? `${a.name} (${a.email})` : a.email}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field kind="input" label="Account or group" help="Part of an email, a name, or an id.">
        {(control) => (
          <input {...control} type="search" name="target" defaultValue={filter.target} maxLength={254} />
        )}
      </Field>
      <Field kind="select" label="Action">
        {(control) => (
          <select {...control} name="action" defaultValue={filter.action ?? ""}>
            <option value="">Any action</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field kind="input" label="From">
        {(control) => <input {...control} type="date" name="from" defaultValue={filter.from} />}
      </Field>
      <Field kind="input" label="To">
        {(control) => <input {...control} type="date" name="to" defaultValue={filter.to} />}
      </Field>
      <div className="flex gap-2 pb-2">
        <Button type="submit" variant="primary">
          Filter
        </Button>
        {hasAuditFilters(filter) && (
          <Button to={adminUrls.audit()} variant="ghost">
            Clear
          </Button>
        )}
      </div>
    </Form>
  );
}
