import { AdminCard } from "../AdminCard";
import type { AdminActionResult } from "../adminForms";

import { STAFF_REASON_MAX } from "@caretook/data/schema";
import { Form, useNavigation } from "react-router";
import { Field, FormFooter } from "~/components/ui";
import { issueFor } from "../adminForms";

// Invite an owner (admins): the owner invite email to an address, for a
// group with nobody suitable to promote. The usual invite rules apply (not a
// current member, not a second waiting invite); the reason goes in the audit
// log.

export function InviteOwnerForm({ result }: { result: AdminActionResult | undefined }) {
  const busy = useNavigation().state !== "idle";
  return (
    <AdminCard id="invite-owner" title="Invite an owner">
      <Form method="post" className="flex flex-col gap-1" data-admin-form="inviteOwner">
        <p className="text-muted text-sm">
          They get the owner invite email and join as an owner when they accept. It expires in 7 days.
        </p>
        <input type="hidden" name="intent" value="inviteOwner" />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field kind="input" label="Email" error={issueFor(result, "email")}>
            {(control) => <input {...control} name="email" type="email" maxLength={254} required />}
          </Field>
          <Field
            kind="input"
            label="Reason"
            help="Recorded in the audit log."
            error={issueFor(result, "reason")}
          >
            {(control) => <input {...control} name="reason" maxLength={STAFF_REASON_MAX} required />}
          </Field>
        </div>
        <FormFooter align="start" submitLabel="Send owner invite" busy={busy} />
      </Form>
    </AdminCard>
  );
}
