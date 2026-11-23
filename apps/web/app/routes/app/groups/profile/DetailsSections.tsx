import type { ProfileSheet } from "~/lib/profiles/urls";
import type { MemberContactLine } from "~/lib/profiles/memberContact";
import type { RecipientDetails } from "~/lib/profiles/recipientDetails";

import { Pencil } from "lucide-react";
import { Link } from "react-router";
import { ContactLines } from "~/components/contact";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { memberContactLines } from "~/lib/profiles/memberContact";
import {
  INSURANCE_RANK_LABELS,
  insuranceCall,
  plansByRank,
  planTitle,
} from "~/lib/profiles/recipientDetails";
import { PROFILE_NEEDS_CONNECTION } from "~/lib/profiles/recipientDisplay";
import { PROFILE_SHEET_STATE, useOnline } from "./profileSheet";

// The writers' cards (profiles slice 3): the recipient's Contact (phones with
// call and text, email, address with maps) and Insurance (each plan by rank,
// with a call action), from the synced details row. The page shows them only
// to owners, admins and caretakers; a viewer's device never has the data.

/** The recipient's phones, email and address, as links. */
export function ContactSection({
  groupId,
  name,
  details,
  canEdit,
}: {
  groupId: string;
  name: string;
  details: RecipientDetails;
  canEdit: boolean;
}) {
  const lines = memberContactLines(name, details);
  return (
    <Section
      id="contact"
      title="Contact"
      actions={canEdit && <EditSheetLink groupId={groupId} sheet="contact" label="Edit contact" />}
    >
      {lines.length ? (
        <ContactLines lines={lines} data-recipient-contact="" />
      ) : (
        <p className="text-base-content/70 text-sm">No phone, email or address yet.</p>
      )}
    </Section>
  );
}

/** Each insurance plan, primary first: its insurer and plan, member ID, group number and a call action. */
export function InsuranceSection({
  groupId,
  details,
  canEdit,
}: {
  groupId: string;
  details: RecipientDetails;
  canEdit: boolean;
}) {
  const plans = plansByRank(details.insurance);
  return (
    <Section
      id="insurance"
      title="Insurance"
      actions={canEdit && <EditSheetLink groupId={groupId} sheet="insurance" label="Edit insurance" />}
    >
      {plans.length ? (
        <ul className="divide-base-300 divide-y">
          {plans.map((plan) => {
            const call = insuranceCall(plan);
            const phoneLine: MemberContactLine[] =
              call && plan.phone
                ? [{ field: "phones", action: call, text: plan.phone.trim(), caption: null, sms: null }]
                : [];
            return (
              <li
                key={plan.id || planTitle(plan)}
                className="space-y-1 py-3 first:pt-0 last:pb-0"
                data-plan={plan.rank}
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-sm badge-outline">{INSURANCE_RANK_LABELS[plan.rank]}</span>
                  <span className="font-medium" data-plan-title="">
                    {planTitle(plan)}
                  </span>
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  <dt className="text-base-content/70">Member ID</dt>
                  <dd className="font-mono break-all" data-member-id="">
                    {plan.memberId}
                  </dd>
                  {plan.groupNumber && (
                    <>
                      <dt className="text-base-content/70">Group number</dt>
                      <dd className="font-mono break-all" data-group-number="">
                        {plan.groupNumber}
                      </dd>
                    </>
                  )}
                </dl>
                <ContactLines lines={phoneLine} data-plan-phone="" />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-base-content/70 text-sm">No insurance plans yet.</p>
      )}
    </Section>
  );
}

/** A card's Edit: a link to its sheet online; offline a disabled button that says why. */
export function EditSheetLink({
  groupId,
  sheet,
  label,
}: {
  groupId: string;
  sheet: ProfileSheet;
  label: string;
}) {
  const online = useOnline();
  const noteId = `profile-${sheet}-offline`;
  if (!online)
    return (
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <button
          type="button"
          className="btn btn-sm"
          disabled
          aria-label={label}
          aria-describedby={noteId}
          data-edit-sheet={sheet}
        >
          <Pencil className="size-4" aria-hidden="true" />
          Edit
        </button>
        <p id={noteId} className="text-base-content/70 max-w-40 text-xs" data-needs-connection="">
          {PROFILE_NEEDS_CONNECTION}
        </p>
      </div>
    );
  return (
    <Link
      to={appUrls.profile(groupId, sheet)}
      state={PROFILE_SHEET_STATE}
      prefetch="render"
      preventScrollReset
      className="btn btn-sm shrink-0"
      aria-label={label}
      data-edit-sheet={sheet}
    >
      <Pencil className="size-4" aria-hidden="true" />
      Edit
    </Link>
  );
}
