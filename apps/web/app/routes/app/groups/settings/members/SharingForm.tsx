import type { ContactValues, SharedField } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/api";

import { CONTACT_LIMITS } from "@caretook/data/schema";
import { useId } from "react";
import { Link, useFetcher } from "react-router";
import { SaveRow } from "~/components/settings";
import { Field } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { NO_CONTACT_YET, SHARING_FIELD, SHARING_HELP, sharingOptions } from "~/lib/memberContact";

/**
 * On your own row: "What this group sees". A checkbox for each contact
 * detail you've entered on your account (nothing ticked until you choose),
 * a link to Contact details, and how you're related to the recipient. Keyed
 * on the synced choices, so a save that syncs back (or a change on another
 * device) refills it.
 */
export function SharingForm({
  contact,
  sharedFields,
  relationship,
  recipientName,
}: {
  contact: ContactValues;
  sharedFields: SharedField[];
  relationship: string | null;
  recipientName: string;
}) {
  const helpId = useId();
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const relationshipError =
    result && !result.ok
      ? result.issues.find((i) => i.path === SHARING_FIELD.relationship)?.message
      : undefined;
  const options = sharingOptions(contact, sharedFields);

  return (
    <fetcher.Form
      key={`${sharedFields.join()}|${relationship ?? ""}`}
      method="post"
      noValidate
      className="bg-base-200/50 mt-2 space-y-2 rounded-box p-3"
      data-sharing-form=""
    >
      <input type="hidden" name="intent" value="updateSharing" />
      <fieldset className="fieldset" aria-describedby={helpId}>
        <legend className="fieldset-legend">What this group sees</legend>
        {options.length === 0 ? (
          <p className="text-base-content/70 text-sm" data-no-contact="">
            {NO_CONTACT_YET}{" "}
            <Link to={appUrls.settings("contact")} className="link">
              Add contact details
            </Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {options.map((option) => (
              <li key={option.field}>
                <label className="flex cursor-pointer items-start gap-2 py-1">
                  <input
                    type="checkbox"
                    name={SHARING_FIELD.share}
                    value={option.field}
                    defaultChecked={option.checked}
                    className="checkbox checkbox-sm mt-0.5"
                    data-share-field={option.field}
                  />
                  <span className="flex min-w-0 flex-col">
                    {option.label}
                    <span className="text-base-content/70 truncate text-sm">{option.preview}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <p id={helpId} className="text-base-content/70 text-sm">
          {SHARING_HELP}{" "}
          {options.length > 0 && (
            <Link to={appUrls.settings("contact")} className="link">
              Edit contact details
            </Link>
          )}
        </p>
      </fieldset>
      <Field
        label={`How you're related to ${recipientName}`}
        help="For example: daughter, neighbour, aide from Sunrise."
        error={relationshipError}
      >
        {(control) => (
          <input
            {...control}
            name={SHARING_FIELD.relationship}
            defaultValue={relationship ?? ""}
            maxLength={CONTACT_LIMITS.relationship}
            autoComplete="off"
            className={`input w-full ${relationshipError ? "input-error" : ""}`}
          />
        )}
      </Field>
      <SaveRow busy={busy} result={result} />
    </fetcher.Form>
  );
}
