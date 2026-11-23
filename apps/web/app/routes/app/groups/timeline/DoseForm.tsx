import type { DoseDetails, DoseStatus } from "@caretook/data/schema";
import type { FormEvent } from "react";
import type { PlannedDose } from "~/lib/medications/dueDoses";
import type { DoseDraft } from "~/lib/assistant/quickEntryDraft";
import type { TimelineEntry } from "~/lib/core/rpc";
import type { MedicationNameRow } from "~/lib/medications/medications.sync";
import type { DoseOption } from "./doseFormData";

import { useState } from "react";
import { isDoseDetails, MEDICATION_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, Field, FormFooter, Message, Notice } from "~/components/ui";
import { DateTimeField } from "~/components/ui/date";
import { formString } from "~/lib/core/form";
import { DOSE_STATUS_OPTIONS, NEW_MEDICATION_OPTION, parseDoseOption } from "./doseFormData";
import { parseOccurredAt } from "./entryFormData";
import { issueFor } from "./formIssues";
import { QuickAddFields } from "./QuickAddFields";
import { useEntryFormSave } from "./useEntryFormSave";

type Props = {
  onDone?: () => void;
  onCancel?: () => void;
} & (
  | {
      /** Logging a new dose: the slots due now, every current medication, then "+ New medication" (`doseSheetOptions`). */
      options: DoseOption[];
      /** Names the group has used, suggested under the quick add's name. */
      names?: readonly MedicationNameRow[];
      /** The option to start on; the first when left out. */
      initialOption?: string | null;
      /** Why a dose about to be logged may be a mistake ("already given"), asked before saving. */
      warningsFor?: (planned: PlannedDose) => string[];
      /** What to fill it in with (quick entry's Edit). */
      draft?: DoseDraft | null;
      /** When it starts at (an ISO time, a past day's +), unless the draft has a time; now when left out. */
      initialAt?: string | null;
      entry?: never;
      medicationName?: never;
    }
  | {
      /** Editing this dose: its medication is fixed. */
      entry: TimelineEntry;
      /** Its medication's label ("Lisinopril 10 mg"). */
      medicationName: string;
      options?: never;
      names?: never;
      initialOption?: never;
      warningsFor?: never;
      draft?: never;
      initialAt?: never;
    }
);

/**
 * Log or edit a dose: the medication (a choice when logging), whether it was
 * given, skipped or refused, the amount (the medication's dose to start
 * with), when (now to start with) and a note. Logging, the last choice
 * ("+ New medication") asks for a medication's name, dose and type instead,
 * and saving adds it with the dose. Posts to the sheet route's clientAction,
 * which writes it locally (`logDose`, `logDoseOfNewMedication`, `updateDose`).
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
  // "+ New medication": its dose is the one typed for it.
  const adding = !entry && choice === NEW_MEDICATION_OPTION;
  const [newDose, setNewDose] = useState("");
  const doseOf = (value: string) =>
    value === NEW_MEDICATION_OPTION ? newDose : (options.find((o) => o.value === value)?.dose ?? "");
  // A slot in a pass logs the pass too, so the dose still answers it after the pass moves.
  const passId = options.find((o) => o.value === choice)?.passId ?? null;
  const draft = props.draft ?? null;
  const [status, setStatus] = useState<DoseStatus>(stored?.status ?? draft?.status ?? "given");
  // The amount follows the chosen medication's dose until it's typed in (or came filled in).
  const [amount, setAmount] = useState({
    value: stored ? (stored.amount ?? "") : (draft?.amount ?? doseOf(choice)),
    // An empty draft amount is quick entry asking: the usual dose must not fill it in.
    typed: !!entry || (draft?.amount ?? null) !== null,
  });
  // Warnings shown for this choice; submitting again with the same ones saves.
  const [warnings, setWarnings] = useState<string[]>([]);
  const choose = (value: string) => {
    setChoice(value);
    setWarnings([]);
    // Leaving "+ New medication" unmounts its fields, which start empty on return like the other
    // drafts here (each choice's own), so its typed dose goes with them.
    const leaving = choice === NEW_MEDICATION_OPTION && value !== NEW_MEDICATION_OPTION;
    if (leaving) setNewDose("");
    if (!amount.typed) setAmount({ value: doseOf(value), typed: false });
  };
  const typeNewDose = (value: string) => {
    setNewDose(value);
    if (!amount.typed) setAmount({ value, typed: false });
  };
  const chooseStatus = (value: DoseStatus) => {
    setStatus(value);
    setWarnings([]);
  };
  const checkWarnings = (event: FormEvent<HTMLFormElement>) => {
    // A new medication has no doses to warn about.
    if (!props.warningsFor || adding) return;
    const occurredAt = parseOccurredAt(formString(new FormData(event.currentTarget), "occurredAt"));
    const found = props.warningsFor({
      medicationId,
      status,
      scheduledFor: picked.slot,
      passId,
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
          {options.length === 1 && adding ? (
            // No medications yet: the quick add is the only choice.
            <input type="hidden" name="medicationId" value={NEW_MEDICATION_OPTION} />
          ) : (
            <ChoiceGroup
              name="medicationId"
              label="Medication"
              options={options}
              value={choice}
              onChange={choose}
              error={issueFor(issues, "details.medicationId")}
            />
          )}
          {passId && <input type="hidden" name="passId" value={passId} />}
          {adding && <QuickAddFields names={props.names ?? []} issues={issues} onDoseChange={typeNewDose} />}
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

      <Field label="Amount (optional)" kind="input" error={issueFor(issues, "details.amount")}>
        {(control) => (
          <input
            {...control}
            name="amount"
            maxLength={MEDICATION_LIMITS.doseAmount}
            value={amount.value}
            onChange={(e) => setAmount({ value: e.target.value, typed: true })}
          />
        )}
      </Field>

      <DateTimeField
        name="occurredAt"
        label="When"
        defaultValue={entry?.occurredAt ?? draft?.occurredAt ?? props.initialAt ?? undefined}
        error={issueFor(issues, "occurredAt")}
      />

      <Field label="Note (optional)" kind="textarea" error={issueFor(issues, "details.note")}>
        {(control) => (
          <textarea
            {...control}
            name="note"
            rows={2}
            maxLength={MEDICATION_LIMITS.doseNote}
            defaultValue={stored?.note ?? draft?.note ?? ""}
          />
        )}
      </Field>

      {warnings.length > 0 && (
        <Notice tone="warning" role="alert" data-dose-warning="">
          {warnings.join(" ")} Log it anyway?
        </Notice>
      )}

      {result && !result.ok && !issues.length && <Message tone="error">{result.error}</Message>}

      <FormFooter
        submitLabel={entry ? "Save changes" : warnings.length ? "Log anyway" : "Log dose"}
        busy={busy}
        busyLabel="Saving…"
        cancel={onCancel && { label: "Cancel", onCancel }}
      />
    </Form>
  );
}
