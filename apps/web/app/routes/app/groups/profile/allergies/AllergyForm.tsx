import type { ActionResult, FieldIssue } from "~/lib/core/api";
import type { LocalAllergy } from "~/lib/medications/allergies.sync";

import { ALLERGY_LIMITS, ALLERGY_SEVERITIES } from "@caretook/data/schema";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { ChoiceGroup, ComboBox, Field, FormFooter, Message } from "~/components/ui";
import { SEVERITY_LABELS } from "~/lib/medications/allergies";
import { reactionSuggestions, substanceSuggestions } from "~/lib/medications/allergySuggestions";
import { ALLERGY_FIELD } from "./allergyActions";

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

const SEVERITY_OPTIONS = ALLERGY_SEVERITIES.map((value) => ({
  value,
  label: value === "unknown" ? "Not known" : SEVERITY_LABELS[value],
}));

/**
 * Add an allergy, or edit one: what they're allergic to, what it does
 * (optional) and how bad it is. Both text fields suggest once you type (the
 * group's own first, then common ones; nothing on focus or for an empty
 * field); any other text is kept as typed. A save calls `onDone`; a refusal shows on its
 * field and takes focus there. The write is local, so it works offline.
 */
export function AllergyForm({
  allergy,
  groupAllergies,
  onDone,
  onCancel,
}: {
  /** Editing this allergy; omit to add one. */
  allergy?: LocalAllergy;
  /** The allergies on file, whose substances and reactions are suggested first. */
  groupAllergies: readonly LocalAllergy[];
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
      <SuggestField
        label="Allergic to"
        name={ALLERGY_FIELD.substance}
        initial={allergy?.substance ?? ""}
        maxLength={ALLERGY_LIMITS.substance}
        placeholder="e.g. Penicillin"
        suggest={(typed) => substanceSuggestions(typed, groupAllergies)}
        error={substanceError}
      />
      <SuggestField
        label="Reaction (optional)"
        name={ALLERGY_FIELD.reaction}
        initial={allergy?.reaction ?? ""}
        maxLength={ALLERGY_LIMITS.reaction}
        placeholder="e.g. Hives"
        suggest={(typed) => reactionSuggestions(typed, groupAllergies)}
        error={reactionError}
      />
      <ChoiceGroup
        label="Severity"
        name={ALLERGY_FIELD.severity}
        options={SEVERITY_OPTIONS}
        defaultValue={allergy?.severity ?? "unknown"}
        className="pt-1"
      />
      {general && <Message tone="error">{general}</Message>}
      <FormFooter
        submitLabel={allergy ? "Save" : "Add allergy"}
        busy={busy}
        cancel={onCancel ? { label: "Cancel", onCancel } : undefined}
      />
    </fetcher.Form>
  );
}

/** A free-text field with suggestions once you type; posts `name`. A pick fills it in. */
function SuggestField({
  label,
  name,
  initial,
  maxLength,
  placeholder,
  suggest,
  error,
}: {
  label: string;
  name: string;
  initial: string;
  maxLength: number;
  placeholder: string;
  suggest: (typed: string) => string[];
  error?: string;
}) {
  const [text, setText] = useState(initial);
  const options = suggest(text).map((id) => ({ id, label: id }));

  return (
    <Field label={label} error={error} kind="input">
      {(control) => (
        <div data-allergy-field={name}>
          <ComboBox
            label={label}
            placeholder={placeholder}
            options={options}
            inputValue={text}
            onInputChange={setText}
            onSelect={setText}
            emptyText="No suggestions: keep typing to use your own words"
            opensOn="typing"
            control={{ ...control, name, maxLength }}
          />
        </div>
      )}
    </Field>
  );
}
