import type { ActionResult, FieldIssue } from "~/lib/api";
import type { LocalPass } from "~/lib/sync/medicationPasses";
import type { LocalMedication, MedicationNameRow } from "~/lib/sync/medications";
import type { LocalProvider } from "~/lib/sync/providers";

import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { MEDICATION_FORMS, MEDICATION_LIMITS } from "@caretook/data/schema";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { useGroup } from "~/lib/group";
import { FORM_LABELS } from "~/lib/medicationDisplay";
import { FIELD, isFieldIssue } from "./medicationFormData";
import { NameField } from "./NameField";
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
    <Field label={label} error={issueFor(issues, name)}>
      {(control) => (
        <input
          {...control}
          name={name}
          className="input w-full"
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
    <Field label={label} error={issueFor(issues, name)}>
      {(control) => (
        <input
          {...control}
          type="date"
          name={name}
          className="input w-full"
          defaultValue={defaultValue ?? ""}
        />
      )}
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
  zoneNote,
  onDone,
  onCancel,
}: {
  /** Editing this medication; omit to add one. */
  medication?: LocalMedication;
  providers: readonly LocalProvider[];
  /** The group's passes, deleted ones too (`useSchedulePasses`). */
  passes: readonly LocalPass[];
  names: readonly MedicationNameRow[];
  zoneNote: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";
  const { id: groupId } = useGroup();
  // The usual dose as typed: the schedule's amounts show it as their placeholder.
  const [dose, setDose] = useState(medication?.dose ?? "");

  // A save closes the sheet; a refusal moves focus to the first field it's about.
  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) {
      onDone();
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
            '[data-provider-picker]:has([data-picker-error]) input:not([type="hidden"])',
          ));
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

      <NameField defaultValue={medication?.name ?? ""} names={names} error={issueFor(issues, "name")} />

      <div className="grid gap-x-3 sm:grid-cols-2">
        <TextField
          label="Strength (optional)"
          name={FIELD.strength}
          defaultValue={medication?.strength}
          max={MEDICATION_LIMITS.strength}
          issues={issues}
          placeholder="e.g. 10 mg"
        />
        <Field label="Form (optional)" error={issueFor(issues, "form")}>
          {(control) => (
            <select
              {...control}
              name={FIELD.form}
              className="select w-full"
              defaultValue={medication?.form ?? ""}
            >
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

      <Field label="Directions (optional)" error={issueFor(issues, "directions")}>
        {(control) => (
          <textarea
            {...control}
            name={FIELD.directions}
            className="textarea w-full"
            rows={2}
            maxLength={MEDICATION_LIMITS.directions}
            defaultValue={medication?.directions ?? ""}
            placeholder="e.g. With food, in the morning"
          />
        )}
      </Field>

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

      <ProviderPickerField
        kind="prescriber"
        providers={providers}
        initialId={medication?.prescriberId ?? null}
        error={issueFor(issues, "prescriberId")}
      />
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
          <Field label="Refills left" error={issueFor(issues, "refillsLeft")}>
            {(control) => (
              <input
                {...control}
                type="number"
                inputMode="numeric"
                name={FIELD.refillsLeft}
                min={0}
                max={MEDICATION_LIMITS.refillsMax}
                step={1}
                className="input w-full"
                defaultValue={medication?.refillsLeft ?? ""}
              />
            )}
          </Field>
          <TextField
            label="Rx number"
            name={FIELD.rxNumber}
            defaultValue={medication?.rxNumber}
            max={MEDICATION_LIMITS.rxNumber}
            issues={issues}
          />
        </div>
      </fieldset>

      {general && (
        <p role="alert" className="text-error text-sm" data-form-error>
          {general}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {medication ? "Save" : "Add medication"}
        </button>
      </div>
    </fetcher.Form>
  );
}
