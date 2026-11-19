import type { FieldIssue } from "~/lib/api";

import { defaultGroupName } from "@caretook/data/schema";
import { useState } from "react";
import { Field } from "~/components/ui";
import { formString } from "~/lib/form";

// "Who do you care for?": the care recipient's name and preferred name, and
// the group's name (empty: "<preferred or first name>'s care", shown as its
// placeholder). Shared by the New care group sheet and /join/:code, so it
// moves to components/ once the components PRD's slice 6 has landed.

const INPUT = "input w-full";

export function NewGroupFields({ issues = [] }: { issues?: FieldIssue[] }) {
  const [recipientName, setRecipientName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const issue = (path: string) => issues.find((i) => i.path === path)?.message;
  const placeholder = recipientName.trim() ? defaultGroupName({ recipientName, preferredName }) : "";
  return (
    <div data-new-group-fields="">
      <Field label="Their name" help="The person you help care for." error={issue("recipientName")}>
        {(control) => (
          <input
            {...control}
            className={INPUT}
            name="recipientName"
            autoComplete="off"
            maxLength={120}
            required
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        )}
      </Field>
      <Field
        label="What you call them"
        help="Optional: Grandma, Dad, a nickname."
        error={issue("preferredName")}
      >
        {(control) => (
          <input
            {...control}
            className={INPUT}
            name="preferredName"
            autoComplete="off"
            maxLength={120}
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
          />
        )}
      </Field>
      <Field
        label="Group name"
        help={placeholder ? `Leave empty for “${placeholder}”.` : "Optional."}
        error={issue("groupName")}
      >
        {(control) => (
          <input
            {...control}
            className={INPUT}
            name="groupName"
            autoComplete="off"
            maxLength={120}
            placeholder={placeholder}
          />
        )}
      </Field>
    </div>
  );
}

/** The form's three fields, for `newCareGroupZSchema`. */
export const newGroupFromForm = (form: FormData) => ({
  recipientName: formString(form, "recipientName"),
  preferredName: formString(form, "preferredName"),
  groupName: formString(form, "groupName"),
});
