import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalCondition } from "~/lib/profiles/conditions.sync";

import { CONDITION_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { ChoiceGroup, Field } from "~/components/ui";
import { MONTH_NAMES } from "~/lib/profiles/conditions";
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
 * A new one also says whether it's active or past. A save calls `onDone`; a
 * refusal shows on its field, which takes focus. The write is local, so it
 * works offline.
 */
export function ConditionForm({
  condition,
  groupNames,
  onDone,
  onCancel,
}: {
  /** Editing this condition; omit to add one. */
  condition?: LocalCondition;
  groupNames: readonly string[];
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
    else
      formRef.current
        ?.querySelector<HTMLElement>(
          issueFor(result.issues, "name") ? "[data-condition-name-field] input" : '[aria-invalid="true"]',
        )
        ?.focus();
  }, [result, onDone]);

  const nameError = issueFor(issues, "name");
  const yearError = issueFor(issues, "sinceYear");
  const monthError = issueFor(issues, "sinceMonth");
  const noteError = issueFor(issues, "note");
  const general =
    result && !result.ok && !nameError && !yearError && !monthError && !noteError ? result.error : undefined;

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
        <Field label="Since: year (optional)" error={yearError}>
          {(control) => (
            <input
              {...control}
              name={CONDITION_FIELD.sinceYear}
              className="input w-full"
              defaultValue={condition?.sinceYear ?? ""}
              inputMode="numeric"
              maxLength={4}
              placeholder="e.g. 2015"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Month (optional)" error={monthError}>
          {(control) => (
            <select
              {...control}
              name={CONDITION_FIELD.sinceMonth}
              className="select w-full"
              defaultValue={condition?.sinceMonth ?? ""}
            >
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
      <Field label="Note (optional)" error={noteError}>
        {(control) => (
          <input
            {...control}
            name={CONDITION_FIELD.note}
            className="input w-full"
            defaultValue={condition?.note ?? ""}
            maxLength={CONDITION_LIMITS.note}
            placeholder="e.g. Diet-controlled"
            autoComplete="off"
          />
        )}
      </Field>
      {!condition && (
        <ChoiceGroup
          label="Status"
          name={CONDITION_FIELD.status}
          options={STATUS_OPTIONS}
          defaultValue="active"
          className="pt-1"
        />
      )}
      {general && (
        <p className="text-error text-sm" role="alert">
          {general}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {condition ? "Save" : "Add condition"}
        </button>
      </div>
    </fetcher.Form>
  );
}
