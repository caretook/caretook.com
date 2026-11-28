import type { ContactValues } from "@caretook/data/schema";
import type { MemberDetailRow } from "~/lib/care-groups/members.sync";

import { useId, useState } from "react";
import { Chevron, Collapse } from "~/components/ui";
import { memberShare, parseSharedFields, sharedSummary } from "~/lib/profiles/memberContact";
import { SharingForm } from "./SharingForm";
import { visibleSharedFields } from "@caretook/data/domain";

/** Your own card's "What this group sees": closed, what you share; open, the form. */
export function YourSharing({
  member,
  contact,
  recipientName,
}: {
  member: MemberDetailRow;
  contact: ContactValues;
  recipientName: string;
}) {
  const [open, setOpen] = useState(false);
  const formId = useId();
  return (
    <div className="mt-2 pl-12">
      <button
        type="button"
        className="link link-hover flex items-center gap-1 text-sm font-medium"
        aria-expanded={open}
        aria-controls={formId}
        data-sharing-toggle=""
        onClick={() => setOpen(!open)}
      >
        <Chevron open={open} />
        What this group sees
      </button>
      {!open && (
        <p data-sharing-summary="" className="text-muted text-sm">
          {sharedSummary(visibleSharedFields(memberShare(member)))}
        </p>
      )}
      <Collapse open={open} id={formId} className="-ml-12">
        <SharingForm
          contact={contact}
          sharedFields={parseSharedFields(member.shared_fields)}
          relationship={member.relationship}
          recipientName={recipientName}
        />
      </Collapse>
    </div>
  );
}
