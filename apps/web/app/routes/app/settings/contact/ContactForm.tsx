import type { ContactValues } from "@caretook/data/schema";
import type { ActionResult } from "~/lib/core/api";

import { CONTACT_LIMITS } from "@caretook/data/schema";
import { useFetcher } from "react-router";
import { PhoneFields } from "~/components/contact";
import { SaveRow } from "~/components/settings";
import { Field } from "~/components/ui";
import { CONTACT_FIELD } from "~/lib/core/contactForm";

/**
 * Your contact details: phone numbers, a contact email (your sign-in email
 * stays private unless you type it here) and an address. Keyed on the saved
 * values, so a save (or a change on another device) refills the form.
 */
export function ContactForm({ contact, signInEmail }: { contact: ContactValues; signInEmail: string }) {
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = busy ? undefined : fetcher.data;
  const issues = result && !result.ok ? result.issues : [];
  const issueFor = (path: string) => issues.find((issue) => issue.path === path)?.message;
  const emailError = issueFor(CONTACT_FIELD.contactEmail);
  const addressError = issueFor(CONTACT_FIELD.address);

  return (
    <fetcher.Form
      key={JSON.stringify(contact)}
      method="post"
      noValidate
      className="space-y-3"
      data-contact-form=""
    >
      <PhoneFields
        initial={contact.phones.length ? contact.phones : undefined}
        issues={issues}
        labelPlaceholder="Mobile"
      />
      <Field
        label="Contact email"
        help={`Your sign-in email (${signInEmail}) stays private unless you enter it here.`}
        error={emailError}
      >
        {(control) => (
          <input
            {...control}
            name={CONTACT_FIELD.contactEmail}
            type="email"
            defaultValue={contact.contactEmail ?? ""}
            maxLength={CONTACT_LIMITS.email}
            autoComplete="email"
            className={`input w-full ${emailError ? "input-error" : ""}`}
          />
        )}
      </Field>
      <Field label="Address" error={addressError}>
        {(control) => (
          <textarea
            {...control}
            name={CONTACT_FIELD.address}
            rows={3}
            defaultValue={contact.address ?? ""}
            maxLength={CONTACT_LIMITS.address}
            autoComplete="street-address"
            className={`textarea w-full ${addressError ? "textarea-error" : ""}`}
          />
        )}
      </Field>
      <SaveRow busy={busy} result={result} />
    </fetcher.Form>
  );
}
