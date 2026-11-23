import type { DoseDetails } from "@caretook/data/schema";
import type { DoseChoice } from "~/lib/medications/medicationTimeline.sync";

import { useState } from "react";
import { useFetcher } from "react-router";
import { MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, ConfirmDialog, Field } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { medicationLabel } from "~/lib/medications/medicationEntries";
import { DOSE_STATUS_OPTIONS } from "../doseFormData";
import { issueFor } from "../formIssues";
import { useEntryFormSave } from "../useEntryFormSave";
import { addableMedications, doseField, DOSE_IDS_FIELD } from "./passSheet";

/** One dose as the sheet shows it. */
export type PassLogDose = {
  id: string;
  occurredAt: string;
  medicationName: string;
  details: DoseDetails;
};

/**
 * The pass sheet's form: each dose's status, amount, time and note, saved
 * together (`intent=save`); "Add a medication" (a given dose in the same
 * round, `intent=add`, at once); and "Delete this log" behind a confirm
 * (`intent=delete`). New doses (added here or on another device) appear as
 * they arrive; edits already typed in the others stay.
 */
export function PassLogForm({
  doses,
  choices,
  onDone,
  onCancel,
}: {
  doses: PassLogDose[];
  /** The group's current medications, as the Dose sheet offers them. */
  choices: DoseChoice[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { Form, formRef, busy, result, issues } = useEntryFormSave({ adding: false, onDone });
  const adder = useFetcher<{ ok: boolean; error?: string }>();
  const remover = useFetcher<{ ok: boolean; error?: string }>();
  const [confirming, setConfirming] = useState(false);
  const addable = addableMedications(choices, doses);
  const [adding, setAdding] = useState("");
  const toAdd = addable.find((c) => c.id === adding) ?? addable[0];
  const sideError =
    (adder.state === "idle" && adder.data && !adder.data.ok && adder.data.error) ||
    (remover.state === "idle" && remover.data && !remover.data.ok && remover.data.error) ||
    null;

  return (
    <div className="space-y-4">
      <Form method="post" ref={formRef} className="space-y-3" noValidate data-pass-log-form>
        <input type="hidden" name="intent" value="save" />
        {doses.map((dose) => (
          <fieldset
            key={dose.id}
            className="rounded-box border-base-300 space-y-1 border p-3"
            data-pass-dose={dose.id}
          >
            <legend className="px-1 font-semibold">{dose.medicationName}</legend>
            <input type="hidden" name={DOSE_IDS_FIELD} value={dose.id} />
            <ChoiceGroup
              name={doseField("status", dose.id)}
              label="Status"
              options={DOSE_STATUS_OPTIONS}
              defaultValue={dose.details.status}
              error={issueFor(issues, `${dose.id}.details.status`)}
            />
            <Field label="Amount (optional)" error={issueFor(issues, `${dose.id}.details.amount`)}>
              {(control) => (
                <input
                  {...control}
                  name={doseField("amount", dose.id)}
                  className="input w-full"
                  maxLength={MEDICATION_LIMITS.doseAmount}
                  defaultValue={dose.details.amount ?? ""}
                />
              )}
            </Field>
            <DateTimeField
              name={doseField("occurredAt", dose.id)}
              label="When"
              defaultValue={dose.occurredAt}
              error={issueFor(issues, `${dose.id}.occurredAt`)}
            />
            <Field label="Note (optional)" error={issueFor(issues, `${dose.id}.details.note`)}>
              {(control) => (
                <textarea
                  {...control}
                  name={doseField("note", dose.id)}
                  className="textarea w-full"
                  rows={1}
                  maxLength={MEDICATION_LIMITS.doseNote}
                  defaultValue={dose.details.note ?? ""}
                />
              )}
            </Field>
          </fieldset>
        ))}
        {result && !result.ok && (
          <p role="alert" className="text-error text-sm">
            {issues.length ? "Check the doses marked above." : result.error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button data-form-cancel="" type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </Form>

      {toAdd && (
        <adder.Form method="post" className="flex items-end gap-2" data-pass-log-add>
          <input type="hidden" name="intent" value="add" />
          <input type="hidden" name="amount" value={toAdd.dose ?? ""} />
          <Field label="Add a medication" className="min-w-0 flex-1">
            {(control) => (
              <select
                {...control}
                name="medicationId"
                className="select w-full"
                value={toAdd.id}
                onChange={(e) => setAdding(e.target.value)}
              >
                {addable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {medicationLabel(c)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <button type="submit" className="btn" disabled={adder.state !== "idle"}>
            Add
          </button>
        </adder.Form>
      )}

      {sideError && (
        <p role="alert" className="text-error text-sm">
          {sideError}
        </p>
      )}

      <button
        type="button"
        className="btn btn-ghost text-error"
        onClick={() => setConfirming(true)}
        disabled={remover.state !== "idle"}
        data-pass-log-delete
      >
        Delete this log
      </button>
      <ConfirmDialog
        open={confirming}
        title="Delete this log?"
        message={`Its ${doses.length === 1 ? "dose" : `${doses.length} doses`} will be removed from the timeline.`}
        confirmLabel="Delete"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void remover.submit({ intent: "delete" }, { method: "post" });
        }}
      />
    </div>
  );
}
