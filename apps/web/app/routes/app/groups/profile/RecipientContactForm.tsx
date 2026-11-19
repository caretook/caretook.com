import type { ActionResult } from "~/lib/api";
import type { RecipientDetails } from "~/lib/recipientDetails";

import { CONTACT_LIMITS } from "@caretook/data/schema";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { PhoneFields } from "~/components/contact";
import { Field } from "~/components/ui";
import { RECIPIENT_CONTACT_FIELD } from "./detailsFormData";
import { SheetButtons } from "./SheetButtons";

/**
 * The Contact sheet's form: the recipient's phones (up to six, each with a
 * label), email and address. It posts to the sheet's action (online only); a
 * save closes the sheet, and an error shows on its field, which takes focus.
 */
export function RecipientContactForm({
  details,
  onDone,
  onCancel,
}: {
  details: RecipientDetails;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const issues = result && !result.ok ? result.issues : [];
  const issueFor = (path: string) => issues.find((issue) => issue.path === path)?.message;
  const emailError = issueFor(RECIPIENT_CONTACT_FIELD.email);
  const addressError = issueFor(RECIPIENT_CONTACT_FIELD.address);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!result) return;
    if (result.ok) onDone();
    else formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [result, onDone]);

  return (
    <fetcher.Form method="post" noValidate className="space-y-3" ref={formRef} data-contact-form="">
      <PhoneFields
        initial={details.phones.length ? details.phones : undefined}
        issues={issues}
        labelPlaceholder="Mobile"
      />
      <Field label="Email" error={emailError}>
        {(control) => (
          <input
            {...control}
            name={RECIPIENT_CONTACT_FIELD.email}
            type="email"
            defaultValue={details.email ?? ""}
            maxLength={CONTACT_LIMITS.email}
            autoComplete="off"
            className={`input w-full ${emailError ? "input-error" : ""}`}
          />
        )}
      </Field>
      <Field label="Address" error={addressError}>
        {(control) => (
          <textarea
            {...control}
            name={RECIPIENT_CONTACT_FIELD.address}
            rows={3}
            defaultValue={details.address ?? ""}
            maxLength={CONTACT_LIMITS.address + 20}
            autoComplete="off"
            className={`textarea w-full ${addressError ? "textarea-error" : ""}`}
          />
        )}
      </Field>
      <SheetButtons busy={busy} result={result} onCancel={onCancel} />
    </fetcher.Form>
  );
}
