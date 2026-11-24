import type { FieldIssue } from "~/lib/core/api";

import { PROVIDER_LIMITS } from "@caretook/data/schema";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, Field, IconButton } from "~/components/ui";
import { PHONE_FIELD } from "~/lib/core/contactForm";

type PhoneRow = { key: number; label: string; number: string };

let phoneKeys = 0;
/** A phone row, keyed so removing one keeps the others' typed values. */
const phoneRow = (label = "", number = ""): PhoneRow => ({ key: phoneKeys++, label, number });

const issueFor = (issues: FieldIssue[], path: string) => issues.find((i) => i.path === path)?.message;

/** The label select's Custom choice; never posted (the text input is). */
const CUSTOM = "(custom)";

/**
 * A row's label as a select of `options`, blank first and Custom last. Custom
 * reveals a text input and moves focus to it. Whichever control is showing
 * posts the row's one `phoneLabel`, so rows stay in order. A stored label that
 * isn't an option opens Custom with its text.
 */
function LabelSelect({
  n,
  options,
  initial,
  error,
}: {
  n: number;
  options: readonly string[];
  initial: string;
  error: string | undefined;
}) {
  const [choice, setChoice] = useState(() => (!initial || options.includes(initial) ? initial : CUSTOM));
  const custom = choice === CUSTOM;
  const customRef = useRef<HTMLInputElement>(null);
  const chosen = useRef(false);
  useEffect(() => {
    if (custom && chosen.current) customRef.current?.focus();
  }, [custom]);

  return (
    <div className="w-32 shrink-0 space-y-1" data-phone-label>
      <Field label={`Phone ${n} label`} labelHidden kind="select" error={custom ? undefined : error}>
        {(control) => (
          <select
            {...control}
            name={custom ? undefined : PHONE_FIELD.label}
            value={choice}
            onChange={(e) => {
              chosen.current = true;
              setChoice(e.target.value);
            }}
          >
            <option value="">No label</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            <option value={CUSTOM}>Custom</option>
          </select>
        )}
      </Field>
      {custom && (
        <Field label={`Phone ${n} custom label`} labelHidden kind="input" error={error}>
          {(control) => (
            <input
              {...control}
              ref={customRef}
              name={PHONE_FIELD.label}
              maxLength={PROVIDER_LIMITS.phoneLabel}
              defaultValue={options.includes(initial) ? "" : initial}
              placeholder="Label"
              autoComplete="off"
            />
          )}
        </Field>
      )}
    </div>
  );
}

/**
 * A form's phone numbers (a provider's, your own contact details): up to
 * `PROVIDER_LIMITS.phones` rows of a label and a number (posted as
 * `phoneLabel` and `phoneNumber`, in order; `phonesFromForm` reads them),
 * each removable, plus "Add a phone number". Each input is described by its
 * own message; the group by the message about the list (too many).
 * `labelPlaceholder` is the label's example ("Office", "Mobile").
 * `labelOptions` makes each label a select of them (`LabelSelect`), with
 * Custom for typing one.
 */
export function PhoneFields({
  initial,
  issues,
  labelPlaceholder = "Office",
  labelOptions,
}: {
  initial: readonly { label: string; number: string }[] | undefined;
  issues: FieldIssue[];
  labelPlaceholder?: string;
  labelOptions?: readonly string[];
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
              {labelOptions ? (
                <LabelSelect
                  n={n}
                  options={labelOptions}
                  initial={phone.label}
                  error={issueFor(issues, `phones.${i}.label`)}
                />
              ) : (
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
              )}
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
