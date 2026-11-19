import type { AdminActionResult } from "../adminForms";

import { STAFF_REASON_MAX } from "@caretook/data/schema";
import { Form, useNavigation } from "react-router";
import { Field } from "~/components/ui";
import { issueFor } from "../adminForms";

// Invite an owner (admins): the owner invite email to an address, for a
// group with nobody suitable to promote. The usual invite rules apply (not a
// current member, not a second waiting invite); the reason goes in the audit
// log.

export function InviteOwnerForm({ result }: { result: AdminActionResult | undefined }) {
  const busy = useNavigation().state !== "idle";
  return (
    <section className="card bg-base-100 shadow-sm" aria-labelledby="invite-owner">
      <Form method="post" className="card-body gap-1" data-admin-form="inviteOwner">
        <h2 id="invite-owner" className="card-title">
          Invite an owner
        </h2>
        <p className="text-base-content/70 text-sm">
          They get the owner invite email and join as an owner when they accept. It expires in 7 days.
        </p>
        <input type="hidden" name="intent" value="inviteOwner" />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field label="Email" error={issueFor(result, "email")}>
            {(control) => (
              <input
                {...control}
                name="email"
                type="email"
                className="input w-full"
                maxLength={254}
                required
              />
            )}
          </Field>
          <Field label="Reason" help="Recorded in the audit log." error={issueFor(result, "reason")}>
            {(control) => (
              <input
                {...control}
                name="reason"
                className="input w-full"
                maxLength={STAFF_REASON_MAX}
                required
              />
            )}
          </Field>
        </div>
        <button type="submit" className="btn btn-primary mt-2 w-fit" disabled={busy}>
          Send owner invite
        </button>
      </Form>
    </section>
  );
}
