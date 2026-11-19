import type { AdminActionResult } from "../adminForms";
import type { AccountActionIntent } from "./accountActions";
import type { ActionCopy, HelpIntent } from "./helpActions";

import { STAFF_REASON_MAX } from "@caretook/data/schema";
import { useState } from "react";
import { useFetcher } from "react-router";
import { ConfirmDialog, Field } from "~/components/ui";
import { issueFor } from "../adminForms";
import { HELP_COPY } from "./helpActions";

// One action on an account's page: a button that opens a confirm with a
// required reason, posting to the page's action. The result is announced
// beside the button; a refusal stays in the dialog. Help actions bring their
// own words; the admin actions (slice 3) pass theirs, and any extra fields.

type Target = { intent: HelpIntent; copy?: undefined } | { intent: AccountActionIntent; copy: ActionCopy };

export function HelpAction({
  intent,
  copy: ownCopy,
  sessionId,
  values,
  disabled = false,
  label,
  className = "btn btn-sm",
}: Target & {
  sessionId?: string;
  /** Extra fields to post (the role being given). */
  values?: Record<string, string>;
  disabled?: boolean;
  /** The button's accessible name, when its text needs more ("Sign out Chrome on Mac"). */
  label?: string;
  className?: string;
}) {
  const copy = ownCopy ?? HELP_COPY[intent];
  const fetcher = useFetcher<AdminActionResult>();
  // What the fetcher held when the dialog opened: a newer success closes it,
  // and only a newer refusal shows inside it.
  const [opened, setOpened] = useState<{ before: AdminActionResult | undefined } | null>(null);
  const [reason, setReason] = useState("");
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  const fresh = opened !== null && result !== opened.before ? result : undefined;
  const open = opened !== null && !(fresh?.ok && !busy);

  const confirm = () =>
    void fetcher.submit(
      { ...values, intent, reason, ...(sessionId ? { sessionId } : {}) },
      { method: "post" },
    );

  return (
    <span className="inline-flex flex-col items-start gap-1" data-help-action={intent}>
      <button
        type="button"
        className={className}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          setOpened({ before: result });
          setReason("");
        }}
      >
        {copy.button}
      </button>
      {!open && result?.ok && (
        <span role="status" className="text-success text-sm">
          {result.message}
        </span>
      )}
      <ConfirmDialog
        open={open}
        title={copy.title}
        message={copy.message}
        confirmLabel={busy ? "Working…" : copy.confirm}
        confirmDisabled={busy || !reason.trim()}
        onConfirm={confirm}
        onClose={() => setOpened(null)}
      >
        <Field label="Reason" help="Recorded in the audit log." error={issueFor(fresh, "reason")}>
          {(control) => (
            <textarea
              {...control}
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={STAFF_REASON_MAX}
              rows={2}
              className="textarea w-full"
              required
            />
          )}
        </Field>
        {fresh && !fresh.ok && !issueFor(fresh, "reason") && (
          <p role="alert" className="text-error mt-2 text-sm">
            {fresh.error}
          </p>
        )}
      </ConfirmDialog>
    </span>
  );
}
