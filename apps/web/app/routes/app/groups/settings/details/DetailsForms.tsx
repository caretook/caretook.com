import type { ActionResult } from "~/lib/api";

import { useFetcher } from "react-router";
import { SaveRow } from "~/components/settings";
import { Field } from "~/components/ui";

// The Details page's forms (online, with the role): the group's name, and the
// care recipient's profile. Each posts its own intent to the route's action.

export function GroupNameForm({ name }: { name: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="renameGroup" />
      <TextField label="Name" name="name" value={name} result={result} maxLength={120} />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

export function RecipientForm(props: { name: string; preferredName: string; dateOfBirth: string }) {
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" noValidate className="space-y-3">
      <input type="hidden" name="intent" value="updateRecipient" />
      <TextField label="Name" name="name" value={props.name} result={result} maxLength={120} />
      <TextField
        label="Preferred name"
        name="preferredName"
        value={props.preferredName}
        result={result}
        maxLength={120}
        help="What everyone calls them. Shown in place of the name."
      />
      <TextField
        label="Date of birth"
        name="dateOfBirth"
        type="date"
        value={props.dateOfBirth}
        result={result}
      />
      <SaveRow busy={fetcher.state !== "idle"} result={result} />
    </fetcher.Form>
  );
}

/**
 * A labelled input with its own error. It's uncontrolled, and keyed on the
 * saved value: typing is never overwritten, but when the saved value changes
 * (your own save syncing back, or another member's edit) the input takes it.
 */
function TextField({
  label,
  name,
  value,
  result,
  type = "text",
  maxLength,
  help,
}: {
  label: string;
  name: string;
  value: string;
  result: ActionResult | undefined;
  type?: "text" | "date";
  maxLength?: number;
  help?: string;
}) {
  const error =
    result && !result.ok ? result.issues.find((issue) => issue.path === name)?.message : undefined;
  return (
    <Field label={label} help={help} error={error}>
      {(control) => (
        <input
          {...control}
          key={value}
          name={name}
          type={type}
          defaultValue={value}
          maxLength={maxLength}
          autoComplete="off"
          className={`input w-full ${error ? "input-error" : ""}`}
        />
      )}
    </Field>
  );
}
