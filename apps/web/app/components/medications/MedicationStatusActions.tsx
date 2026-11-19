import type { MedicationStopReason } from "@caretook/data/schema";
import type { MenuEntry } from "~/components/ui";
import type { ActionResult } from "~/lib/api";
import type { StatusIntent } from "~/lib/medicationStatusForm";
import type { LocalMedication } from "~/lib/sync/medications";

import { Ban, CircleCheck, Ellipsis, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { MEDICATION_LIMITS, MEDICATION_STOP_REASONS } from "@caretook/data/schema";
import { ChoiceGroup, ConfirmDialog, Field, Menu, SEPARATOR } from "~/components/ui";
import { medicationTitle, STOP_REASON_LABELS, stoppedText } from "~/lib/medicationDisplay";
import { STATUS_FIELD } from "~/lib/medicationStatusForm";
import { dayInZone } from "~/lib/sync/medications";

type Dialog = Exclude<StatusIntent, "restart">;

const REASON_OPTIONS = MEDICATION_STOP_REASONS.map((r) => ({ value: r, label: STOP_REASON_LABELS[r] }));

const deviceZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * A medication's status actions, for writers: Mark completed and Discontinue
 * (a current one), Restart (a stopped one), and Delete. Completing and
 * deleting ask first; Discontinue asks why (required), with an optional note
 * and the day it stopped (today in the recipient's zone unless changed);
 * Restart goes ahead. Each posts to the route it's on (its clientAction
 * makes the device write, `statusRequestFromForm`), and `onDone` hears of
 * each write that went through.
 *
 * `layout` "menu" is a ⋯ menu (the medication page's header); "buttons" is a
 * row of buttons under the current status (the edit sheet).
 */
export function MedicationStatusActions({
  medication,
  recipientTimeZone,
  layout,
  onDone,
}: {
  medication: LocalMedication;
  recipientTimeZone: string | null;
  layout: "menu" | "buttons";
  onDone?: (intent: StatusIntent) => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reason, setReason] = useState<MedicationStopReason | "">("");
  const [note, setNote] = useState("");
  const [stoppedOn, setStoppedOn] = useState("");
  const sent = useRef<StatusIntent | null>(null);
  const handled = useRef<ActionResult | undefined>(undefined);
  const title = medicationTitle(medication);
  const current = medication.status === "current";

  const open = (next: Dialog) => {
    setReason("");
    setNote("");
    setStoppedOn(dayInZone(new Date(), recipientTimeZone ?? deviceZone()));
    // A message from an earlier try doesn't carry over.
    fetcher.reset();
    setDialog(next);
  };

  const restart = () => {
    setDialog(null);
    submit("restart");
  };

  const submit = (intent: StatusIntent, fields: Record<string, string> = {}) => {
    sent.current = intent;
    void fetcher.submit({ [STATUS_FIELD.intent]: intent, ...fields }, { method: "post" });
  };

  // A write that went through is reported once; a refusal stays in its dialog, with its message.
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data?.ok || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (sent.current) onDone?.(sent.current);
  }, [fetcher.state, fetcher.data, onDone]);

  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  // The dialog closes once its write goes through (opening one clears the last result).
  const shown = result?.ok ? null : dialog;
  const refusal = result && !result.ok ? result : null;
  const reasonError = refusal?.issues.find((i) => i.path === "stopReason")?.message;
  // Another field's message ("It can't stop before it started"), else the refusal's own.
  const otherError = refusal && !reasonError ? (refusal.issues[0]?.message ?? refusal.error) : null;
  const busy = fetcher.state !== "idle";

  const items: MenuEntry[] = [
    current && {
      id: "complete",
      label: "Mark completed",
      icon: CircleCheck,
      onAction: () => open("complete"),
    },
    current && { id: "discontinue", label: "Discontinue…", icon: Ban, onAction: () => open("discontinue") },
    !current && { id: "restart", label: "Restart", icon: RotateCcw, onAction: restart },
    SEPARATOR,
    { id: "remove", label: "Delete", icon: Trash2, tone: "danger", onAction: () => open("remove") },
  ];

  const stopDay = (
    <Field label="Stopped on">
      {(control) => (
        <input
          {...control}
          type="date"
          name={STATUS_FIELD.stoppedOn}
          className="input w-full"
          value={stoppedOn}
          onChange={(e) => setStoppedOn(e.target.value)}
        />
      )}
    </Field>
  );

  return (
    <>
      {layout === "menu" ? (
        <Menu
          label={`Actions for ${title}`}
          items={items}
          className="btn btn-ghost btn-sm btn-square shrink-0"
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Menu>
      ) : (
        <section aria-labelledby="medication-status-heading" className="space-y-2" data-status-actions>
          <h3 id="medication-status-heading" className="font-semibold">
            Status
          </h3>
          <p className="text-base-content/70 text-sm" data-status-now>
            {stoppedText(medication) ?? "Current: taken now"}
          </p>
          <div className="flex flex-wrap gap-2">
            {current ? (
              <>
                <button type="button" className="btn btn-sm" onClick={() => open("complete")}>
                  <CircleCheck className="size-4" aria-hidden="true" />
                  Mark completed
                </button>
                <button type="button" className="btn btn-sm" onClick={() => open("discontinue")}>
                  <Ban className="size-4" aria-hidden="true" />
                  Discontinue…
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-sm" disabled={busy} onClick={restart}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Restart
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost text-error ml-auto"
              onClick={() => open("remove")}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete medication
            </button>
          </div>
        </section>
      )}

      {!shown && otherError && (
        <p role="alert" className="text-error text-sm">
          {otherError}
        </p>
      )}

      <ConfirmDialog
        open={shown === "complete"}
        title={`Mark ${title} completed?`}
        message="It moves below the current medications. Restart it if it was a mistake."
        confirmLabel="Mark completed"
        confirmDisabled={busy}
        onConfirm={() => submit("complete", { [STATUS_FIELD.stoppedOn]: stoppedOn })}
        onClose={() => setDialog(null)}
      >
        {stopDay}
        {otherError && (
          <p role="alert" className="text-error text-sm">
            {otherError}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={shown === "discontinue"}
        title={`Discontinue ${title}?`}
        message="Say why it was stopped early. It moves below the current medications."
        confirmLabel="Discontinue"
        confirmDisabled={busy}
        onConfirm={() =>
          submit("discontinue", {
            [STATUS_FIELD.stopReason]: reason,
            [STATUS_FIELD.stopNote]: note,
            [STATUS_FIELD.stoppedOn]: stoppedOn,
          })
        }
        onClose={() => setDialog(null)}
      >
        <div data-discontinue-form>
          <ChoiceGroup
            name={STATUS_FIELD.stopReason}
            label="Why was it stopped?"
            options={REASON_OPTIONS}
            value={reason}
            onChange={setReason}
            error={reasonError}
          />
          <Field label="Note (optional)">
            {(control) => (
              <textarea
                {...control}
                name={STATUS_FIELD.stopNote}
                className="textarea w-full"
                rows={2}
                maxLength={MEDICATION_LIMITS.stopNote}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          {stopDay}
          {otherError && (
            <p role="alert" className="text-error text-sm">
              {otherError}
            </p>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={shown === "remove"}
        title={`Delete ${title}?`}
        message="Only for a medication added by mistake: it leaves the list. Its doses and changes stay on the timeline. To record that it was stopped, discontinue it instead."
        confirmLabel="Delete"
        confirmDisabled={busy}
        onConfirm={() => submit("remove")}
        onClose={() => setDialog(null)}
      >
        {otherError && (
          <p role="alert" className="text-error text-sm">
            {otherError}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
