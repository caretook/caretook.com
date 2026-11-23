import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { CONDITION_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { ProviderPickerField, ProvidersPickerField } from "~/components/providers";
import { ChoiceGroup, Field, FormFooter, Message } from "~/components/ui";
import { MONTH_NAMES } from "~/lib/profiles/conditions";
import { fitsCondition } from "~/lib/providers/providerPicker";
import { CONDITION_FIELD } from "./conditionActions";
import { ConditionNameField } from "./ConditionNameField";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Past (resolved)" },
];

/**
 * Add a condition, or edit one: its name (with suggestions), roughly since
 * when (an optional year, and an optional month with it) and a short note.
 * A new one also says whether it's active or past. Who diagnosed it (one
 * provider) and who manages it (any number) are picked from the group's
 * providers, or added by name with the save. A save calls `onDone`; a
 * refusal shows on its field, which takes focus. The write is local, so it
 * works offline.
 */
export function ConditionForm({
  condition,
  groupNames,
  providers,
  managerIds = [],
  onDone,
  onCancel,
}: {
  /** Editing this condition; omit to add one. */
  condition?: LocalCondition;
  groupNames: readonly string[];
  /** The group's providers, deleted ones too (`useFormProviders`). */
  providers: readonly LocalProvider[];
  /** Who manages it as the form opens. */
  managerIds?: readonly string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const issues = result && !result.ok ? result.issues : [];

  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok) onDone();
    else {
      const form = formRef.current;
      // The name, else the first field marked invalid, else a picker with an error.
      const target = issueFor(result.issues, "name")
        ? form?.querySelector<HTMLElement>("[data-condition-name-field] input")
        : (form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
          form?.querySelector<HTMLElement>(
            ':is([data-provider-picker], [data-providers-picker]):has([data-picker-error]) :is(input:not([type="hidden"]), button)',
          ));
      target?.focus();
    }
  }, [result, onDone]);

  const nameError = issueFor(issues, "name");
  const yearError = issueFor(issues, "sinceYear");
  const monthError = issueFor(issues, "sinceMonth");
  const noteError = issueFor(issues, "note");
  const diagnosedError = issueFor(issues, "diagnosedById");
  const managedError = issueFor(issues, "managedBy");
  const general =
    result &&
    !result.ok &&
    ![nameError, yearError, monthError, noteError, diagnosedError, managedError].some(Boolean)
      ? result.error
      : undefined;

  return (
    <fetcher.Form
      method="post"
      ref={formRef}
      className="space-y-1"
      noValidate
      data-condition-form={condition ? "edit" : "add"}
    >
      <input type="hidden" name={CONDITION_FIELD.intent} value={condition ? "update" : "create"} />
      {condition && <input type="hidden" name={CONDITION_FIELD.conditionId} value={condition.id} />}
      <ConditionNameField initial={condition?.name ?? ""} groupNames={groupNames} error={nameError} />
      <div className="grid grid-cols-2 gap-3">
        <Field kind="input" label="Since: year (optional)" error={yearError}>
          {(control) => (
            <input
              {...control}
              name={CONDITION_FIELD.sinceYear}
              defaultValue={condition?.sinceYear ?? ""}
              inputMode="numeric"
              maxLength={4}
              placeholder="e.g. 2015"
              autoComplete="off"
            />
          )}
        </Field>
        <Field kind="select" label="Month (optional)" error={monthError}>
          {(control) => (
            <select {...control} name={CONDITION_FIELD.sinceMonth} defaultValue={condition?.sinceMonth ?? ""}>
              <option value="">No month</option>
              {MONTH_NAMES.map((month, i) => (
                <option key={month} value={i + 1}>
                  {month}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field kind="input" label="Note (optional)" error={noteError}>
        {(control) => (
          <input
            {...control}
            name={CONDITION_FIELD.note}
            defaultValue={condition?.note ?? ""}
            maxLength={CONDITION_LIMITS.note}
            placeholder="e.g. Diet-controlled"
            autoComplete="off"
          />
        )}
      </Field>
      <ProviderPickerField
        pickerId="diagnosedBy"
        name={CONDITION_FIELD.diagnosedById}
        newName={CONDITION_FIELD.newDiagnosedBy}
        legend="Diagnosed by (optional)"
        chipsLabel="Diagnosed by"
        noun="provider"
        placeholder="Search the group's providers"
        emptyText="No providers match"
        fits={fitsCondition}
        providers={providers}
        initialId={condition?.diagnosedById ?? null}
        error={diagnosedError}
      />
      <input type="hidden" name={CONDITION_FIELD.managers} value="1" />
      <ProvidersPickerField
        pickerId="managedBy"
        name={CONDITION_FIELD.managerId}
        newName={CONDITION_FIELD.newManager}
        legend="Managed by (optional)"
        chipsLabel="Providers who manage it"
        comboLabel="Add a provider who manages it"
        noun="provider"
        placeholder="Search the group's providers"
        emptyText="No other providers match"
        fits={fitsCondition}
        providers={providers}
        initialIds={managerIds}
        error={managedError}
      />
      {!condition && (
        <ChoiceGroup
          label="Status"
          name={CONDITION_FIELD.status}
          options={STATUS_OPTIONS}
          defaultValue="active"
          className="pt-1"
        />
      )}
      {general && <Message tone="error">{general}</Message>}
      <FormFooter
        submitLabel={condition ? "Save" : "Add condition"}
        busy={busy}
        cancel={{ label: "Cancel", onCancel }}
      />
    </fetcher.Form>
  );
}
