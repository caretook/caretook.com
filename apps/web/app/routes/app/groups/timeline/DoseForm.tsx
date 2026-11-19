import type { DoseDetails, DoseStatus } from "@caretook/data/schema";
import type { TimelineEntry } from "~/lib/rpc";
import type { DoseChoice } from "~/lib/sync/medicationTimeline";

import { useState } from "react";
import { isDoseDetails, MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, Field } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { medicationLabel } from "~/lib/medicationEntries";
import { DOSE_STATUS_OPTIONS } from "./doseFormData";
import { issueFor } from "./formIssues";
import { useEntryFormSave } from "./useEntryFormSave";

type Props = {
  onDone?: () => void;
  onCancel?: () => void;
} & (
  | {
      /** Logging a new dose of one of these current medications (most recently given first). */
      choices: DoseChoice[];
      /** The medication to start on; the first choice when left out. */
      initialMedicationId?: string | null;
      /** The slot the dose answers ("08:00"), posted with it. */
      slot?: string | null;
      entry?: never;
      medicationName?: never;
    }
  | {
      /** Editing this dose: its medication is fixed. */
      entry: TimelineEntry;
      /** Its medication's label ("Lisinopril 10 mg"). */
      medicationName: string;
      choices?: never;
      initialMedicationId?: never;
      slot?: never;
    }
);

/**
 * Log or edit a dose: the medication (a choice when logging), whether it was
 * given, skipped or refused, the amount (the medication's dose to start
 * with), when (now to start with) and a note. Posts to the sheet route's
 * clientAction, which writes it locally (`logDose`, `updateDose`).
 */
export function DoseForm(props: Props) {
  const { entry, onDone, onCancel } = props;
  const { Form, formRef, busy, result, issues } = useEntryFormSave({ adding: !entry, onDone });
  const stored: DoseDetails | undefined = isDoseDetails(entry?.details) ? entry.details : undefined;
  const choices = props.choices ?? [];
  const [medicationId, setMedicationId] = useState(
    () =>
      choices.find((c) => c.id === props.initialMedicationId)?.id ?? choices[0]?.id ?? stored?.medicationId,
  );
  const doseOf = (id: string | undefined) => choices.find((c) => c.id === id)?.dose ?? "";
  const [status, setStatus] = useState<DoseStatus>(stored?.status ?? "given");
  // The amount follows the chosen medication's dose until it's typed in.
  const [amount, setAmount] = useState({
    value: stored ? (stored.amount ?? "") : doseOf(medicationId),
    typed: !!entry,
  });
  const choose = (id: string) => {
    setMedicationId(id);
    if (!amount.typed) setAmount({ value: doseOf(id), typed: false });
  };

  return (
    <Form method="post" ref={formRef} className="space-y-1" noValidate>
      {entry ? (
        <p className="font-semibold" data-dose-medication>
          {props.medicationName}
        </p>
      ) : (
        <>
          <ChoiceGroup
            name="medicationId"
            label="Medication"
            options={choices.map((c) => ({ value: c.id, label: medicationLabel(c) }))}
            value={medicationId ?? ""}
            onChange={choose}
            error={issueFor(issues, "details.medicationId")}
          />
          {props.slot && <input type="hidden" name="scheduledFor" value={props.slot} />}
        </>
      )}

      <ChoiceGroup
        name="status"
        label="Status"
        options={DOSE_STATUS_OPTIONS}
        value={status}
        onChange={setStatus}
        error={issueFor(issues, "details.status")}
      />

      <Field label="Amount (optional)" error={issueFor(issues, "details.amount")}>
        {(control) => (
          <input
            {...control}
            name="amount"
            className="input w-full"
            maxLength={MEDICATION_LIMITS.doseAmount}
            value={amount.value}
            onChange={(e) => setAmount({ value: e.target.value, typed: true })}
          />
        )}
      </Field>

      <DateTimeField
        name="occurredAt"
        label="When"
        defaultValue={entry?.occurredAt}
        error={issueFor(issues, "occurredAt")}
      />

      <Field label="Note (optional)" error={issueFor(issues, "details.note")}>
        {(control) => (
          <textarea
            {...control}
            name="note"
            className="textarea w-full"
            rows={2}
            maxLength={MEDICATION_LIMITS.doseNote}
            defaultValue={stored?.note ?? ""}
          />
        )}
      </Field>

      {result && !result.ok && !issues.length && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : entry ? "Save changes" : "Log dose"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </Form>
  );
}
