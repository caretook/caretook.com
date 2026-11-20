import type { FieldIssue } from "~/lib/api";

import { PROVIDER_LIMITS } from "@caretook/data/schema";
import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { IconButton } from "~/components/ui";
import { PHONE_FIELD } from "~/lib/contactForm";

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

  const field = (path: string) => {
    const message = issueFor(issues, path);
    const errorId = `${id}-${path.replace(/\./g, "-")}-error`;
    return {
      message,
      errorId,
      props: { "aria-invalid": !!message, "aria-describedby": message ? errorId : undefined },
    };
  };
  const count = field("phones");

  return (
    <fieldset className="fieldset" aria-describedby={count.message ? count.errorId : undefined}>
      <legend className="fieldset-legend">Phone numbers</legend>
      <ul className="space-y-2" data-phones>
        {phones.map((phone, i) => {
          const number = field(`phones.${i}.number`);
          const label = field(`phones.${i}.label`);
          const n = i + 1;
          return (
            <li key={phone.key} className="space-y-1" data-phone-row>
              <div className="flex items-center gap-2">
                <input
                  name={PHONE_FIELD.label}
                  aria-label={`Phone ${n} label`}
                  className="input w-28 shrink-0"
                  maxLength={PROVIDER_LIMITS.phoneLabel}
                  defaultValue={phone.label}
                  placeholder={labelPlaceholder}
                  autoComplete="off"
                  {...label.props}
                />
                <input
                  name={PHONE_FIELD.number}
                  type="tel"
                  aria-label={`Phone ${n} number`}
                  className="input min-w-0 flex-1"
                  maxLength={PROVIDER_LIMITS.phoneNumber}
                  defaultValue={phone.number}
                  placeholder="(555) 010-0000"
                  autoComplete="off"
                  {...number.props}
                />
                <IconButton
                  label={`Remove phone ${n}`}
                  icon={X}
                  className="shrink-0"
                  onPress={() => setPhones((rows) => rows.filter((r) => r.key !== phone.key))}
                />
              </div>
              <Message id={label.errorId} text={label.message} />
              <Message id={number.errorId} text={number.message} />
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={full}
          onClick={() => setPhones((rows) => [...rows, phoneRow()])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add a phone number
        </button>
        {full && (
          <span className="text-base-content/70 text-sm">{PROVIDER_LIMITS.phones} numbers is the most</span>
        )}
      </div>
      <Message id={count.errorId} text={count.message} />
    </fieldset>
  );
}

/** A message tied to its input by id. */
function Message({ id, text }: { id: string; text: string | undefined }) {
  if (!text) return null;
  return (
    <p id={id} className="text-error text-sm">
      {text}
    </p>
  );
}
