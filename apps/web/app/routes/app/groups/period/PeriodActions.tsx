import type { ActionResult } from "~/lib/core/api";

import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { ConfirmDialog, Menu } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { PERIOD_SHEET_STATE } from "~/lib/care-periods/periodSheets";

/** The page's delete intent, posted to its clientAction. */
export const DELETE_INTENT = "delete";

/**
 * A writer's actions on a period: Edit (the edit sheet, which comes back
 * here) and ⋯ with Delete, behind a confirm that says what happens to the
 * track. A delete calls `onDeleted` once it's written.
 */
export function PeriodActions({
  groupId,
  periodId,
  title,
  deleteMessage,
  onDeleted,
}: {
  groupId: string;
  periodId: string;
  title: string;
  deleteMessage: string;
  onDeleted: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const [confirming, setConfirming] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  useEffect(() => {
    if (result?.ok) onDeleted();
  }, [result, onDeleted]);

  return (
    <>
      <Link
        to={appUrls.editPeriod(groupId, periodId)}
        // Closing the sheet comes back here.
        state={PERIOD_SHEET_STATE}
        prefetch="render"
        className="btn btn-ghost btn-sm gap-1"
        data-edit-period
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Link>
      <Menu
        label={`Actions for ${title}`}
        items={[
          {
            id: "delete",
            label: "Delete",
            icon: Trash2,
            tone: "danger",
            onAction: () => setConfirming(true),
          },
        ]}
        className="btn btn-ghost btn-sm btn-square shrink-0"
      >
        <Ellipsis className="size-4" aria-hidden="true" />
      </Menu>
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        title="Delete this care period?"
        message={deleteMessage}
        confirmLabel="Delete"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void fetcher.submit({ intent: DELETE_INTENT }, { method: "post" });
        }}
      />
    </>
  );
}
