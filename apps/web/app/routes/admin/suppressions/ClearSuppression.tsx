import type { AdminActionResult } from "../adminForms";

import { STAFF_REASON_MAX } from "@caretook/data/schema";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button, ConfirmDialog, Field, Message } from "~/components/ui";
import { issueFor } from "../adminForms";

/** The fetcher every Clear shares, so the page can say it's done after the row is gone. */
export const CLEAR_FETCHER = "clear-suppression";

// Clear one address's suppression (`users.help`): a button that opens a
// confirm with a required reason, posting to the page's action. A refusal
// stays in the dialog; a success closes it, and the page announces it (the
// row leaves the list).

export function ClearSuppression({ address }: { address: string }) {
  const fetcher = useFetcher<AdminActionResult>({ key: CLEAR_FETCHER });
  // What the fetcher held when the dialog opened: only a newer result counts.
  const [opened, setOpened] = useState<{ before: AdminActionResult | undefined } | null>(null);
  const [reason, setReason] = useState("");
  const busy = fetcher.state !== "idle";
  const fresh = opened !== null && fetcher.data !== opened.before ? fetcher.data : undefined;
  const open = opened !== null && !(fresh?.ok && !busy);

  return (
    <>
      <Button
        size="sm"
        aria-label={`Clear ${address}`}
        onClick={() => {
          setOpened({ before: fetcher.data });
          setReason("");
        }}
      >
        Clear
      </Button>
      <ConfirmDialog
        open={open}
        title="Clear this suppression?"
        message={`Email to ${address} is sent again. Another hard bounce or complaint suppresses it again.`}
        confirmLabel={busy ? "Working…" : "Clear it"}
        confirmDisabled={busy || !reason.trim()}
        onConfirm={() => void fetcher.submit({ intent: "clear", address, reason }, { method: "post" })}
        onClose={() => setOpened(null)}
      >
        <Field
          kind="textarea"
          label="Reason"
          help="Recorded in the audit log."
          error={issueFor(fresh, "reason")}
        >
          {(control) => (
            <textarea
              {...control}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={STAFF_REASON_MAX}
              rows={2}
              required
            />
          )}
        </Field>
        {fresh && !fresh.ok && !issueFor(fresh, "reason") && (
          <Message tone="error" className="mt-2">
            {fresh.error}
          </Message>
        )}
      </ConfirmDialog>
    </>
  );
}
