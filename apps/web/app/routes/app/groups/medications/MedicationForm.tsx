import type { MedicationType, NewMedicationDraft } from "@caretook/data/schema";
import type { ActionResult, CreateResult, FieldIssue } from "~/lib/core/api";
import type { LocalPass } from "~/lib/medications/medicationPasses.sync";
import type { LocalMedication, MedicationNameRow } from "~/lib/medications/medications.sync";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { useEffect, useId, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { MEDICATION_FORMS, MEDICATION_LIMITS, MEDICATION_TYPES } from "@caretook/data/schema";
import { NameField } from "~/components/medications";
import { Chevron, ChoiceGroup, Collapse, Field, FormFooter, Message } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { FORM_LABELS, MEDICATION_TYPE_LABELS } from "~/lib/medications/medicationDisplay";
import { CONDITION_IDS_PATH } from "~/lib/profiles/medicationConditions.sync";
import { ConditionsField } from "./ConditionsField";
import { FIELD, isFieldIssue } from "./medicationFormData";
import { ProviderPickerField } from "./ProviderPickerField";
import { ScheduleFields } from "./ScheduleFields";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/** A one-line text field, posting `name`. */
function TextField({
  label,
  name,
  defaultValue,
  max,
  issues,
  placeholder,
  onChange,
}: {
  label: string;
  name: (typeof FIELD)[keyof typeof FIELD];
  defaultValue: string | null | undefined;
  max: number;
  issues: FieldIssue[];
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <Field label={label} error={issueFor(issues, name)} kind="input">
      {(control) => (
        <input
          {...control}
          name={name}
          maxLength={max}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          autoComplete="off"
          onChange={onChange && ((e) => onChange(e.target.value))}
        />
      )}
    </Field>
  );
}

const TYPE_OPTIONS = MEDICATION_TYPES.map((type) => ({ value: type, label: MEDICATION_TYPE_LABELS[type] }));

/** The fields that fold into "Prescription details" for a type other than Prescription. */
const PRESCRIPTION_FIELDS = [FIELD.prescriberId, FIELD.newPrescriber, FIELD.refillsLeft, FIELD.rxNumber];

/** Whether any prescription-only field in the form has a value (so its section stays open). */
const hasPrescriptionDetails = (form: HTMLFormElement | null) => {
  if (!form) return false;
  const data = new FormData(form);
  return PRESCRIPTION_FIELDS.some((name) => {
    const value = data.get(name);
    return typeof value === "string" && value.trim() !== "";
  });
};

/** A calendar day, posting `name` ("YYYY-MM-DD", or empty for none). */
function DayField({
  label,
  name,
  defaultValue,
  issues,
}: {
  label: string;
  name: (typeof FIELD)[keyof typeof FIELD];
  defaultValue: string | null | undefined;
  issues: FieldIssue[];
}) {
  return (
    <Field label={label} error={issueFor(issues, name)} kind="input">
      {(control) => <input {...control} type="date" name={name} defaultValue={defaultValue ?? ""} />}
    </Field>
  );
}

/**
 * Add or edit a medication. Posts to its sheet route's clientAction, which
 * writes on the device (with its change entry, and any prescriber or
 * pharmacy added here); the shared Zod schema's messages show on the fields.
 * The status (completed, discontinued) isn't edited here: the status actions
 * do that.
 */
export function MedicationForm({
  medication,
  providers,
  passes,
  names,
  conditions = [],
  conditionIds = [],
  zoneNote,
  draft,
  onDone,
  onCancel,
}: {
  /** Editing this medication; omit to add one. */
  medication?: LocalMedication;
  /** Adding: what the fields start with (quick entry's "new med lisinopril 10 mg tablet"). */
  draft?: Pick<NewMedicationDraft, "name" | "strength" | "form" | "directions"> | null;
  providers: readonly LocalProvider[];
  /** The group's passes, deleted ones too (`useSchedulePasses`). */
  passes: readonly LocalPass[];
  names: readonly MedicationNameRow[];
  /** The recipient's live conditions, for the For field (conditions slice 4). */
  conditions?: readonly LocalCondition[];
  /** What the medication is for as the form opens. */
  conditionIds?: readonly string[];
  zoneNote: string | null;
  /** After a save; adding one passes the new medication's id. The form itself never navigates. */
  onDone: (id?: string) => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult | CreateResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";
  const { id: groupId } = useGroup();
  // The usual dose as typed: the schedule's amounts show it as their placeholder.
  const [dose, setDose] = useState(medication?.dose ?? "");
  // A new medication starts on Prescription; an old one with no type starts on none (required on save).
  const [type, setType] = useState<MedicationType | null>(medication ? medication.type : "prescription");
  // For a type other than Prescription, the prescription-only fields fold away
  // unless one has a value. Their values are kept and saved whatever the type.
  const folds = type !== null && type !== "prescription";
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      !!medication &&
      (medication.prescriberId !== null || medication.refillsLeft !== null || !!medication.rxNumber),
  );
  const detailsId = useId();
  // A refused field folded away: its section opens first, then it takes focus.
  const focusOnOpen = useRef<HTMLElement | null>(null);
  useEffect(() => {
    focusOnOpen.current?.focus();
    focusOnOpen.current = null;
  }, [detailsOpen]);
  const chooseType = (next: MedicationType) => {
    setType(next);
    if (next !== "prescription") setDetailsOpen(hasPrescriptionDetails(formRef.current));
  };

  // A save goes to `onDone`; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | CreateResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      onDone("id" in fetcher.data ? fetcher.data.id : undefined);
      return;
    }
    const form = formRef.current;
    // The first field marked invalid (the times' group: its first time), else a picker with an error.
    const invalid = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target =
      invalid instanceof HTMLFieldSetElement
        ? invalid.querySelector<HTMLElement>("input, button")
        : (invalid ??
          form?.querySelector<HTMLElement>(
            '[data-provider-picker]:has([data-picker-error]) input:not([type="hidden"]), [data-conditions-picker]:has([data-picker-error]) input:not([type="hidden"])',
          ));
    // A field folded into "Prescription details" opens its section first.
    if (target?.closest("[data-prescription-details] > [data-collapse]:not([data-open])")) {
      focusOnOpen.current = target;
      setDetailsOpen(true);
      return;
    }
    target?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const unshown = issues.filter((i) => !isFieldIssue(i.path));
  const general =
    result && !result.ok && (issues.length === 0 || unshown.length > 0)
      ? (unshown[0]?.message ?? result.error)
      : undefined;

  return (
    <fetcher.Form method="post" ref={formRef} className="space-y-1" noValidate data-medication-form>
      <input type="hidden" name="intent" value={medication ? "update" : "create"} />

      <NameField
        defaultValue={medication?.name ?? draft?.name ?? ""}
        names={names}
        error={issueFor(issues, "name")}
      />

      <ChoiceGroup
        name={FIELD.type}
        label="Type"
        options={TYPE_OPTIONS}
        value={type}
        onChange={chooseType}
        error={issueFor(issues, "type")}
      />

      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Strength (optional)"
          name={FIELD.strength}
          defaultValue={medication?.strength ?? draft?.strength}
          max={MEDICATION_LIMITS.strength}
          issues={issues}
          placeholder="e.g. 10 mg"
        />
        <Field label="Form (optional)" error={issueFor(issues, "form")} kind="select">
          {(control) => (
            <select {...control} name={FIELD.form} defaultValue={medication?.form ?? draft?.form ?? ""}>
              <option value="">Not set</option>
              {MEDICATION_FORMS.map((form) => (
                <option key={form} value={form}>
                  {FORM_LABELS[form]}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <TextField
        label="Dose each time (optional)"
        name={FIELD.dose}
        defaultValue={medication?.dose}
        max={MEDICATION_LIMITS.dose}
        issues={issues}
        placeholder="e.g. 1 tablet"
        onChange={setDose}
      />

      <ScheduleFields
        initial={medication?.schedule ?? null}
        passes={passes}
        dose={dose}
        passesHref={appUrls.medicationPasses(groupId)}
        issues={issues}
        zoneNote={zoneNote}
      />

      <Field label="Directions (optional)" error={issueFor(issues, "directions")} kind="textarea">
        {(control) => (
          <textarea
            {...control}
            name={FIELD.directions}
            rows={2}
            maxLength={MEDICATION_LIMITS.directions}
            defaultValue={medication?.directions ?? draft?.directions ?? ""}
            placeholder="e.g. With food, in the morning"
          />
        )}
      </Field>

      <ConditionsField
        conditions={conditions}
        initialIds={conditionIds}
        error={issueFor(issues, CONDITION_IDS_PATH)}
      />

      <TextField
        label="Why it's taken (optional)"
        name={FIELD.reason}
        defaultValue={medication?.reason}
        max={MEDICATION_LIMITS.reason}
        issues={issues}
        placeholder="e.g. Blood pressure"
      />

      <DayField
        label="Started on (optional)"
        name={FIELD.startedOn}
        defaultValue={medication?.startedOn}
        issues={issues}
      />

      {/* One element for every type, so the fields keep what's typed when the type changes. */}
      <div
        className={folds ? "rounded-box border-base-300 my-2 border px-3 py-1" : undefined}
        data-prescription-details
      >
        {folds && (
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-1.5 py-1.5 text-start font-medium"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            data-prescription-toggle
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <Chevron open={detailsOpen} />
            Prescription details
          </button>
        )}
        <Collapse open={!folds || detailsOpen} id={detailsId}>
          <ProviderPickerField
            kind="prescriber"
            providers={providers}
            initialId={medication?.prescriberId ?? null}
            error={issueFor(issues, "prescriberId")}
          />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <Field label="Refills left (optional)" error={issueFor(issues, "refillsLeft")} kind="input">
              {(control) => (
                <input
                  {...control}
                  type="number"
                  inputMode="numeric"
                  name={FIELD.refillsLeft}
                  min={0}
                  max={MEDICATION_LIMITS.refillsMax}
                  step={1}
                  defaultValue={medication?.refillsLeft ?? ""}
                />
              )}
            </Field>
            <TextField
              label="Rx number (optional)"
              name={FIELD.rxNumber}
              defaultValue={medication?.rxNumber}
              max={MEDICATION_LIMITS.rxNumber}
              issues={issues}
            />
          </div>
        </Collapse>
      </div>
      <ProviderPickerField
        kind="pharmacy"
        providers={providers}
        initialId={medication?.pharmacyId ?? null}
        error={issueFor(issues, "pharmacyId")}
      />

      <fieldset className="fieldset pt-2" data-refills>
        <legend className="fieldset-legend">Refills (optional)</legend>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <DayField
            label="Last filled"
            name={FIELD.lastFilledOn}
            defaultValue={medication?.lastFilledOn}
            issues={issues}
          />
          <TextField
            label="Quantity"
            name={FIELD.quantity}
            defaultValue={medication?.quantity}
            max={MEDICATION_LIMITS.quantity}
            issues={issues}
            placeholder="e.g. 30 tablets"
          />
        </div>
      </fieldset>

      {general && (
        <Message tone="error" data-form-error="">
          {general}
        </Message>
      )}

      <FormFooter
        submitLabel={medication ? "Save" : "Add medication"}
        busy={busy}
        cancel={{ label: "Cancel", onCancel }}
      />
    </fetcher.Form>
  );
}
