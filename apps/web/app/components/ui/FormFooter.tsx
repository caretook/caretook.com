import type { ReactNode } from "react";
import type { To } from "react-router";

import { Button } from "./Button";

/** The footer's Cancel: a link back, or a callback (a sheet's close). */
export type FormFooterCancel =
  { label: string; to: To; onCancel?: never } | { label: string; onCancel: () => void; to?: never };

/**
 * The bottom of a form: Cancel (when given), then the submit button, with one
 * gap and one top padding. Right-aligned by default; `align="start"` puts the
 * buttons at the start, as settings forms have them. `status` is a slot for
 * what happened ("Saved.", an error line): after the buttons when start-aligned,
 * before them when right-aligned.
 */
export function FormFooter({
  submitLabel,
  busy = false,
  busyLabel,
  submitDisabled = false,
  danger = false,
  cancel,
  status,
  align = "end",
  className = "",
}: {
  submitLabel: string;
  /** The form is being sent: the submit button is disabled and shows `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  /** Holds the submit button back (nothing to save yet). */
  submitDisabled?: boolean;
  /** The form's one job is the destructive act: a solid red submit. */
  danger?: boolean;
  cancel?: FormFooterCancel;
  status?: ReactNode;
  align?: "end" | "start";
  /** Classes for the outer element. */
  className?: string;
}) {
  const buttons = (
    <>
      {cancel &&
        (cancel.to !== undefined ? (
          <Button to={cancel.to} data-form-cancel="">
            {cancel.label}
          </Button>
        ) : (
          <Button onClick={cancel.onCancel} data-form-cancel="">
            {cancel.label}
          </Button>
        ))}
      <Button
        type="submit"
        variant={danger ? "danger" : "primary"}
        busy={busy}
        busyLabel={busyLabel}
        disabled={submitDisabled}
      >
        {submitLabel}
      </Button>
    </>
  );
  const slot = status ? <div className="min-w-0 text-sm">{status}</div> : null;
  return (
    <div
      className={`flex flex-wrap items-center gap-2 pt-4 ${align === "end" ? "justify-end" : ""} ${className}`}
    >
      {align === "end" ? (
        <>
          {slot && <div className="me-auto">{slot}</div>}
          {buttons}
        </>
      ) : (
        <>
          {buttons}
          {slot}
        </>
      )}
    </div>
  );
}
