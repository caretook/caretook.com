import type { FormEvent, ReactNode } from "react";
import type { FieldControl, FieldKind } from "~/components/ui/plain";
import type { FieldCopy, FormThanksContent } from "./types";
import type { FormFailure } from "./forms";

import { useEffect, useRef, useState } from "react";
import { Button, Field, Notice } from "~/components/ui/plain";
import { formFailure } from "./forms";
import { HONEYPOT_FIELD } from "@caretook/data/domain";

// The marketing site's public forms' shared parts: the submit state (with
// the time on the page and the honeypot), fields with labels and linked
// errors, and the thanks, announced politely. The waitlist and contact forms
// compose them; the API call is theirs.

export type SubmitGuard = { website: string; elapsedMs: number };

type FormState = { status: "idle" | "sending" | "sent"; failure: FormFailure | null };

/**
 * A public form's submit: one request at a time, the time since the form
 * appeared and the honeypot's value passed to `send`, then the thanks or
 * what went wrong. After a failure, focus moves to the first field in error.
 */
export function usePublicForm(send: (form: FormData, guard: SubmitGuard) => Promise<unknown>) {
  const shownAt = useRef<number | null>(null);
  // The form last submitted (set in the handler), so focus can move into it after a failure.
  const submitted = useRef<HTMLFormElement | null>(null);
  const [state, setState] = useState<FormState>({ status: "idle", failure: null });

  // From hydration: a prerendered form can't be submitted through us before then.
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!state.failure) return;
    submitted.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state.failure]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status === "sending") return;
    submitted.current = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const website = form.get(HONEYPOT_FIELD);
    const guard = {
      website: typeof website === "string" ? website : "",
      elapsedMs: shownAt.current === null ? 0 : Math.max(0, Date.now() - shownAt.current),
    };
    setState({ status: "sending", failure: null });
    send(form, guard).then(
      () => setState({ status: "sent", failure: null }),
      (error: unknown) => setState({ status: "idle", failure: formFailure(error) }),
    );
  };

  return {
    onSubmit,
    sending: state.status === "sending",
    sent: state.status === "sent",
    failure: state.failure,
    error: (field: string) => state.failure?.fields[field],
  };
}

type FieldProps = {
  name: string;
  copy: FieldCopy;
  error?: string;
  required?: boolean;
};

/** The kit's field at the site's larger text size: a label, its control, a hint and a linked error. */
function FieldShell({
  name,
  copy,
  error,
  required,
  kind,
  children,
}: FieldProps & { kind: FieldKind; children: (control: FieldControl) => ReactNode }) {
  return (
    <div data-field={name}>
      <Field
        kind={kind}
        className="text-base"
        label={copy.label}
        required={required}
        help={copy.hint}
        error={error}
      >
        {(control) => children({ ...control, className: `${control.className} text-lg` })}
      </Field>
    </div>
  );
}

export function TextField({
  type = "text",
  autoComplete,
  maxLength,
  ...field
}: FieldProps & { type?: "text" | "email"; autoComplete?: string; maxLength?: number }) {
  return (
    <FieldShell {...field} kind="input">
      {(control) => (
        <input
          {...control}
          name={field.name}
          type={type}
          required={field.required}
          autoComplete={autoComplete}
          maxLength={maxLength}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ maxLength, ...field }: FieldProps & { maxLength?: number }) {
  return (
    <FieldShell {...field} kind="textarea">
      {(control) => (
        <textarea {...control} name={field.name} required={field.required} maxLength={maxLength} rows={6} />
      )}
    </FieldShell>
  );
}

export function SelectField({
  none,
  options,
  ...field
}: FieldProps & { none: string; options: { value: string; label: string }[] }) {
  return (
    <FieldShell {...field} kind="select">
      {(control) => (
        <select {...control} name={field.name} required={field.required} defaultValue="">
          <option value="">{none}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

/**
 * The honeypot: a field people never see or reach (off screen, hidden from
 * assistive tech, out of the tab order). Bots that fill every field fill it.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

/**
 * The form, or its thanks once sent. The status region is there from the
 * start, so screen readers announce the thanks (politely) when it fills.
 */
export function PublicFormFrame({
  label,
  form,
  thanks,
  children,
}: {
  label: string;
  form: ReturnType<typeof usePublicForm>;
  thanks: FormThanksContent;
  children: ReactNode;
}) {
  return (
    <div className="relative rounded-box bg-base-100 p-5 text-base-content shadow-sm sm:p-7">
      <div role="status" aria-live="polite" data-form-thanks>
        {form.sent && (
          <>
            <p className="text-xl font-semibold">{thanks.heading}</p>
            <p className="mt-2 leading-relaxed text-base-content/80">{thanks.body}</p>
          </>
        )}
      </div>
      {!form.sent && (
        <form aria-label={label} noValidate onSubmit={form.onSubmit} className="flex flex-col gap-5">
          {form.failure && (
            <Notice tone="error" data-form-error="">
              {form.failure.message}
            </Notice>
          )}
          {children}
          <Honeypot />
        </form>
      )}
    </div>
  );
}

export function SubmitButton({
  sending,
  label,
  sendingLabel,
}: {
  sending: boolean;
  label: string;
  sendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      className="self-start"
      aria-disabled={sending || undefined}
    >
      {sending ? sendingLabel : label}
    </Button>
  );
}
