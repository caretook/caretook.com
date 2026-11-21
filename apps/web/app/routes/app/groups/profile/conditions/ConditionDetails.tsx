import type { ReactNode } from "react";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";

import { useState } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { CONDITION_STATUS_LABELS, sinceDate } from "~/lib/profiles/conditions";
import { PROFILE_SHEET_STATE } from "../profileSheet";

export type ConditionIntent = "resolve" | "reactivate" | "remove";

/**
 * One condition's view: its status, since and note, for every member.
 * Writers get Edit, Resolve (or Reactivate, for a past one) and Delete,
 * which asks first: deleting is for a mistake, resolving keeps it as history.
 */
export function ConditionDetails({
  groupId,
  condition,
  canWrite,
  busy,
  refusal,
  medications,
  providers,
  onAction,
  onClose,
}: {
  groupId: string;
  condition: LocalCondition;
  /** Its current medications, under the details (conditions slice 4). */
  medications?: ReactNode;
  /** Who diagnosed it and who manages it, under the details (conditions slice 3). */
  providers?: ReactNode;
  canWrite: boolean;
  busy: boolean;
  refusal: string | null;
  onAction: (intent: ConditionIntent) => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const since = sinceDate(condition);
  const active = condition.status === "active";

  return (
    <div className="space-y-4" data-condition-view={condition.id}>
      <dl className="grid grid-cols-2 gap-3">
        <div data-condition-line="status">
          <dt className="text-base-content/70 text-sm">Status</dt>
          <dd className="font-medium">{CONDITION_STATUS_LABELS[condition.status]}</dd>
        </div>
        <div data-condition-line="since">
          <dt className="text-base-content/70 text-sm">Since</dt>
          <dd className="font-medium">{since ?? "Not recorded"}</dd>
        </div>
        {condition.note && (
          <div className="col-span-2" data-condition-line="note">
            <dt className="text-base-content/70 text-sm">Note</dt>
            <dd className="whitespace-pre-line">{condition.note}</dd>
          </div>
        )}
      </dl>
      {providers}
      {medications}
      {refusal && (
        <p className="text-error text-sm" role="alert">
          {refusal}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {canWrite && (
          <>
            <button
              type="button"
              className="btn btn-ghost text-error mr-auto"
              onClick={() => setConfirming(true)}
              disabled={busy}
              data-delete-condition=""
            >
              Delete
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => onAction(active ? "resolve" : "reactivate")}
              disabled={busy}
              data-condition-status-action={active ? "resolve" : "reactivate"}
            >
              {active ? "Mark resolved" : "Mark active again"}
            </button>
            <Link
              to={appUrls.editCondition(groupId, condition.id)}
              // Saving or cancelling comes back to this sheet.
              state={PROFILE_SHEET_STATE}
              preventScrollReset
              className="btn"
              data-edit-condition=""
            >
              Edit
            </Link>
          </>
        )}
        <button type="button" className="btn btn-primary" onClick={onClose} data-condition-done="">
          Done
        </button>
      </div>
      {canWrite && (
        <ConfirmDialog
          open={confirming}
          title={`Delete ${condition.name}?`}
          message={
            active
              ? "Only for a mistake: it comes off the profile everywhere. If it's over, mark it resolved instead."
              : "Only for a mistake: it comes off the profile everywhere, Past included."
          }
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirming(false);
            onAction("remove");
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
