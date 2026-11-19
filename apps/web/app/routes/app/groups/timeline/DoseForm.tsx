import type { DoseDetails, DoseStatus } from "@caretook/data/schema";
import type { FormEvent } from "react";
import type { PlannedDose } from "~/lib/dueDoses";
import type { TimelineEntry } from "~/lib/rpc";
import type { DoseOption } from "./doseFormData";

import { useState } from "react";
import { isDoseDetails, MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, Field } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { formString } from "~/lib/form";
import { DOSE_STATUS_OPTIONS, parseDoseOption } from "./doseFormData";
import { parseOccurredAt } from "./entryFormData";
import { issueFor } from "./formIssues";
import { useEntryFormSave } from "./useEntryFormSave";

type Props = {
  onDone?: () => void;
  onCancel?: () => void;
} & (
  | {
      /** Logging a new dose: the slots due now, then every current medication (`doseSheetOptions`). */
      options: DoseOption[];
      /** The option to start on; the first when left out. */
      initialOption?: string | null;
      /** Why a dose about to be logged may be a mistake ("already given"), asked before saving. */
      warningsFor?: (planned: PlannedDose) => string[];
      entry?: never;
      medicationName?: never;
    }
  | {
      /** Editing this dose: its medication is fixed. */
      entry: TimelineEntry;
      /** Its medication's label ("Lisinopril 10 mg"). */
      medicationName: string;
      options?: never;
      initialOption?: never;
      warningsFor?: never;
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
  const options = props.options ?? [];
  const [choice, setChoice] = useState(
    () => options.find((o) => o.value === props.initialOption)?.value ?? options[0]?.value ?? "",
  );
  const picked = parseDoseOption(choice);
  const medicationId = entry ? (stored?.medicationId ?? "") : picked.medicationId;
  const doseOf = (value: string) => options.find((o) => o.value === value)?.dose ?? "";
  const [status, setStatus] = useState<DoseStatus>(stored?.status ?? "given");
  // The amount follows the chosen medication's dose until it's typed in.
  const [amount, setAmount] = useState({
    value: stored ? (stored.amount ?? "") : doseOf(choice),
    typed: !!entry,
  });
  // Warnings shown for this choice; submitting again with the same ones saves.
  const [warnings, setWarnings] = useState<string[]>([]);
  const choose = (value: string) => {
    setChoice(value);
    setWarnings([]);
    if (!amount.typed) setAmount({ value: doseOf(value), typed: false });
  };
  const chooseStatus = (value: DoseStatus) => {
    setStatus(value);
    setWarnings([]);
  };
  const checkWarnings = (event: FormEvent<HTMLFormElement>) => {
    if (!props.warningsFor) return;
    const occurredAt = parseOccurredAt(formString(new FormData(event.currentTarget), "occurredAt"));
    const found = props.warningsFor({
      medicationId,
      status,
      scheduledFor: picked.slot,
      occurredAt: occurredAt || null,
    });
    if (found.length && found.join("\n") !== warnings.join("\n")) {
      event.preventDefault();
      setWarnings(found);
    }
  };

  return (
    <Form method="post" ref={formRef} className="space-y-1" noValidate onSubmit={checkWarnings}>
      {entry ? (
        <p className="font-semibold" data-dose-medication>
          {props.medicationName}
        </p>
      ) : (
        <>
          <ChoiceGroup
            name="medicationId"
            label="Medication"
            options={options}
            value={choice}
            onChange={choose}
            error={issueFor(issues, "details.medicationId")}
          />
        </>
      )}

      <ChoiceGroup
        name="status"
        label="Status"
        options={DOSE_STATUS_OPTIONS}
        value={status}
        onChange={chooseStatus}
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

      {warnings.length > 0 && (
        <div role="alert" className="alert alert-warning text-sm" data-dose-warning>
          <p>{warnings.join(" ")} Log it anyway?</p>
        </div>
      )}

      {result && !result.ok && !issues.length && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : entry ? "Save changes" : warnings.length ? "Log anyway" : "Log dose"}
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
