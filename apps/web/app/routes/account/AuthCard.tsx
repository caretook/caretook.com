import type { FormEvent, ReactNode } from "react";

import { useCallback, useRef } from "react";
import { useSubmit } from "react-router";
import { Field, Message, Notice } from "~/components/ui/plain";

// The card every signed-out account page sits in (sign-in, reset password,
// verify email). Shared by those routes only, so it lives beside them.

/**
 * One press, one request (B-1): an onSubmit for every account form. It
 * submits through the router itself and drops any further submit until that
 * one has finished. The buttons' `disabled` only lands on the next render,
 * which two quick taps can beat.
 */
export function useSubmitOnce() {
  const submit = useSubmit();
  const pending = useRef(false);
  return useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending.current) return;
      pending.current = true;
      const form = event.currentTarget;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      void submit(submitter instanceof HTMLButtonElement ? submitter : form, { method: "post" }).finally(
        () => {
          pending.current = false;
        },
      );
    },
    [submit],
  );
}

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="card bg-base-100 w-full max-w-sm shadow-md">
        <div className="card-body gap-4">
          <h1 className="card-title text-2xl">{title}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}

/** An email field (the same on every account form). */
export function EmailField({ defaultValue }: { defaultValue?: string }) {
  return (
    <Field label="Email">
      {(control) => (
        <input
          {...control}
          className="input w-full"
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={defaultValue}
          required
        />
      )}
    </Field>
  );
}

/** A polite announcement ("Check your email…"). */
export function StatusMessage({ children }: { children: ReactNode }) {
  return <Notice>{children}</Notice>;
}

/** A form error, announced at once. */
export function ErrorMessage({ children }: { children: ReactNode }) {
  return <Message tone="error">{children}</Message>;
}
