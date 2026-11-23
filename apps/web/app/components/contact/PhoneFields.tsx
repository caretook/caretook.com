import type { FieldIssue } from "~/lib/core/api";

import { PROVIDER_LIMITS } from "@caretook/data/schema";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Button, Field, IconButton } from "~/components/ui";
import { PHONE_FIELD } from "~/lib/core/contactForm";

type PhoneRow = { key: number; label: string; number: string };

let phoneKeys = 0;
/** A phone row, keyed so removing one keeps the others' typed values. */
const phoneRow = (label = "", number = ""): PhoneRow => ({ key: phoneKeys++, label, number });

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/**
 * A form's phone numbers (a provider's, your own contact details): up to
 * `PROVIDER_LIMITS.phones` rows of a label and a number (posted as
 * `phoneLabel` and `phoneNumber`, in order; `phonesFromForm` reads them),
 * each removable, plus "Add a phone number". Each input is described by its
 * own message; the group by the message about the list (too many).
 * `labelPlaceholder` is the label's example ("Office", "Mobile").
 */
export function PhoneFields({
  initial,
  issues,
  labelPlaceholder = "Office",
}: {
  initial: readonly { label: string; number: string }[] | undefined;
  issues: FieldIssue[];
  labelPlaceholder?: string;
}) {
  const id = useId();
  const [phones, setPhones] = useState<PhoneRow[]>(() =>
    initial ? initial.map((p) => phoneRow(p.label, p.number)) : [phoneRow()],
  );
  const full = phones.length >= PROVIDER_LIMITS.phones;

  const countError = issueFor(issues, "phones");
  const countErrorId = `${id}-phones-error`;

  return (
    <fieldset className="fieldset" aria-describedby={countError ? countErrorId : undefined}>
      <legend className="fieldset-legend">Phone numbers</legend>
      <ul className="space-y-2" data-phones>
        {phones.map((phone, i) => {
          const n = i + 1;
          return (
            <li key={phone.key} className="flex items-start gap-2" data-phone-row>
              <Field
                label={`Phone ${n} label`}
                labelHidden
                kind="input"
                error={issueFor(issues, `phones.${i}.label`)}
                className="w-28 shrink-0"
              >
                {(control) => (
                  <input
                    {...control}
                    name={PHONE_FIELD.label}
                    maxLength={PROVIDER_LIMITS.phoneLabel}
                    defaultValue={phone.label}
                    placeholder={labelPlaceholder}
                    autoComplete="off"
                  />
                )}
              </Field>
              <Field
                label={`Phone ${n} number`}
                labelHidden
                kind="input"
                error={issueFor(issues, `phones.${i}.number`)}
                className="min-w-0 flex-1"
              >
                {(control) => (
                  <input
                    {...control}
                    name={PHONE_FIELD.number}
                    type="tel"
                    maxLength={PROVIDER_LIMITS.phoneNumber}
                    defaultValue={phone.number}
                    placeholder="(555) 010-0000"
                    autoComplete="off"
                  />
                )}
              </Field>
              <IconButton
                label={`Remove phone ${n}`}
                icon={X}
                className="shrink-0"
                onPress={() => setPhones((rows) => rows.filter((r) => r.key !== phone.key))}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          disabled={full}
          onClick={() => setPhones((rows) => [...rows, phoneRow()])}
        >
          Add a phone number
        </Button>
        {full && <span className="text-muted text-sm">{PROVIDER_LIMITS.phones} numbers is the most</span>}
      </div>
      {countError && (
        <p id={countErrorId} className="text-error-ink text-sm">
          {countError}
        </p>
      )}
    </fieldset>
  );
}
