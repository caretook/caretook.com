import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalAllergy } from "~/lib/medications/allergies.sync";

import { ALLERGY_LIMITS, ALLERGY_SEVERITIES } from "@caretook/data/schema";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { ChoiceGroup, Field } from "~/components/ui";
import { SEVERITY_LABELS } from "~/lib/medications/allergies";
import { ALLERGY_FIELD } from "./allergyActions";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const SEVERITY_OPTIONS = ALLERGY_SEVERITIES.map((value) => ({
  value,
  label: value === "unknown" ? "Not known" : SEVERITY_LABELS[value],
}));

/**
 * Add an allergy, or edit one: what they're allergic to, what it does
 * (optional) and how bad it is. A save calls `onDone`; a refusal shows on its
 * field and takes focus there. The write is local, so it works offline.
 */
export function AllergyForm({
  allergy,
  onDone,
  onCancel,
}: {
  /** Editing this allergy; omit to add one. */
  allergy?: LocalAllergy;
  onDone: () => void;
  /** Editing only: back to the list without saving. */
  onCancel?: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const issues = result && !result.ok ? result.issues : [];
  const busy = fetcher.state !== "idle";

  const handled = useRef<ActionResult | undefined>(undefined);
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data || handled.current === fetcher.data) return;
    handled.current = fetcher.data;
    if (fetcher.data.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fetcher.state, fetcher.data, onDone]);

  const substanceError = issueFor(issues, "substance");
  const reactionError = issueFor(issues, "reaction");
  const general = result && !result.ok && !substanceError && !reactionError ? result.error : undefined;

  return (
    <fetcher.Form
      method="post"
      ref={formRef}
      className="space-y-1"
      noValidate
      data-allergy-form={allergy ? "edit" : "add"}
    >
      <input type="hidden" name={ALLERGY_FIELD.intent} value={allergy ? "update" : "create"} />
      {allergy && <input type="hidden" name={ALLERGY_FIELD.allergyId} value={allergy.id} />}
      <Field label="Allergic to" error={substanceError}>
        {(control) => (
          <input
            {...control}
            name={ALLERGY_FIELD.substance}
            className="input w-full"
            defaultValue={allergy?.substance ?? ""}
            maxLength={ALLERGY_LIMITS.substance}
            placeholder="e.g. Penicillin"
            autoComplete="off"
            required
          />
        )}
      </Field>
      <Field label="Reaction (optional)" error={reactionError}>
        {(control) => (
          <input
            {...control}
            name={ALLERGY_FIELD.reaction}
            className="input w-full"
            defaultValue={allergy?.reaction ?? ""}
            maxLength={ALLERGY_LIMITS.reaction}
            placeholder="e.g. Hives"
            autoComplete="off"
          />
        )}
      </Field>
      <ChoiceGroup
        label="Severity"
        name={ALLERGY_FIELD.severity}
        options={SEVERITY_OPTIONS}
        defaultValue={allergy?.severity ?? "unknown"}
        className="pt-1"
      />
      {general && (
        <p className="text-error text-sm" role="alert">
          {general}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-3">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {allergy ? "Save" : "Add allergy"}
        </button>
      </div>
    </fetcher.Form>
  );
}
