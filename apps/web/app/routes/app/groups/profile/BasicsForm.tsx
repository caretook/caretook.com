import type { ActionResult } from "~/lib/api";
import type { RecipientProfile } from "~/lib/sync/profile";
import type { BasicsField } from "./basicsFormData";

import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { BLOOD_TYPES, CODE_STATUSES, RECIPIENT_LIMITS } from "@caretook/data/schema";
import { ChoiceGroup, Field } from "~/components/ui";
import { bloodTypeLabel, CODE_STATUS_LABELS, PROFILE_NEEDS_CONNECTION } from "~/lib/recipientDisplay";
import { useOnline } from "./profileSheet";

const NOT_SET = "Not set";

const CODE_STATUS_OPTIONS = [
  { value: "", label: NOT_SET },
  ...CODE_STATUSES.map((value) => ({ value, label: CODE_STATUS_LABELS[value] })),
];

/**
 * The Basics sheet's form: name, preferred name, birthday, code status, blood
 * type, language, pronouns and the note for helpers. It posts every field to
 * the sheet's action (online only); a save closes the sheet, and an error
 * shows on its field, which takes focus.
 */
export function BasicsForm({
  profile,
  onDone,
  onCancel,
}: {
  profile: RecipientProfile;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const online = useOnline();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!result) return;
    if (result.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [result, onDone]);

  const error = (field: BasicsField) =>
    result && !result.ok ? result.issues.find((issue) => issue.path === field)?.message : undefined;

  return (
    <fetcher.Form method="post" noValidate className="space-y-1" ref={formRef} data-basics-form="">
      <TextInput
        label="Name"
        name="name"
        value={profile.name}
        error={error("name")}
        max={RECIPIENT_LIMITS.name}
      />
      <TextInput
        label="Preferred name"
        name="preferredName"
        value={profile.preferredName}
        error={error("preferredName")}
        max={RECIPIENT_LIMITS.preferredName}
        help="What everyone calls them. Shown in place of the name."
      />
      <Field label="Birthday" error={error("dateOfBirth")}>
        {(control) => (
          <input
            {...control}
            name="dateOfBirth"
            type="date"
            defaultValue={profile.dateOfBirth ?? ""}
            className={`input w-full ${error("dateOfBirth") ? "input-error" : ""}`}
          />
        )}
      </Field>
      <ChoiceGroup
        label="Code status"
        name="codeStatus"
        options={CODE_STATUS_OPTIONS}
        defaultValue={profile.codeStatus ?? ""}
        error={error("codeStatus")}
      />
      <Field label="Blood type" error={error("bloodType")}>
        {(control) => (
          <select
            {...control}
            name="bloodType"
            defaultValue={profile.bloodType ?? ""}
            className={`select w-full ${error("bloodType") ? "select-error" : ""}`}
          >
            <option value="">{NOT_SET}</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {bloodTypeLabel(type)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <TextInput
        label="Primary language"
        name="primaryLanguage"
        value={profile.primaryLanguage}
        error={error("primaryLanguage")}
        max={RECIPIENT_LIMITS.primaryLanguage}
      />
      <TextInput
        label="Pronouns"
        name="pronouns"
        value={profile.pronouns}
        error={error("pronouns")}
        max={RECIPIENT_LIMITS.pronouns}
      />
      <Field
        label="Note for helpers"
        help="What anyone helping should know, such as “hard of hearing on the left; uses a walker”."
        error={error("notes")}
      >
        {(control) => (
          <textarea
            {...control}
            name="notes"
            rows={4}
            defaultValue={profile.notes ?? ""}
            maxLength={RECIPIENT_LIMITS.notes + 20}
            className={`textarea w-full ${error("notes") ? "textarea-error" : ""}`}
          />
        )}
      </Field>

      {!online && (
        <p className="text-base-content/70 text-sm" data-needs-connection="">
          {PROFILE_NEEDS_CONNECTION}
        </p>
      )}
      {result && !result.ok && (
        <p role="alert" className="text-error text-sm">
          {result.error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !online}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </fetcher.Form>
  );
}

/**
 * A text input with its own error. Uncontrolled: what's typed stays through a
 * refused save. `maxLength` is a little over the limit, so a pasted long text
 * gets the field's message rather than being cut short silently.
 */
function TextInput({
  label,
  name,
  value,
  error,
  max,
  help,
}: {
  label: string;
  name: BasicsField;
  value: string | null;
  error: string | undefined;
  max: number;
  help?: string;
}) {
  return (
    <Field label={label} help={help} error={error}>
      {(control) => (
        <input
          {...control}
          name={name}
          defaultValue={value ?? ""}
          maxLength={max + 20}
          autoComplete="off"
          className={`input w-full ${error ? "input-error" : ""}`}
        />
      )}
    </Field>
  );
}
