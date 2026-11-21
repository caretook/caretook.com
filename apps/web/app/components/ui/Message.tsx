import type { ReactNode } from "react";

/** What a message or notice says: an error is announced at once, the others politely. */
export type MessageTone = "error" | "success" | "warning" | "info";

const TEXT: Record<MessageTone, string> = {
  error: "text-error",
  success: "text-success",
  warning: "text-warning",
  info: "",
};

/** A tone's live-region role: an error interrupts (`alert`), the rest wait (`status`). */
export const toneRole = (tone: MessageTone) => (tone === "error" ? "alert" : "status");

/**
 * One inline line saying what happened ("Saved.", an error). `error` is
 * `role="alert"`, the other tones `role="status"`. With nothing to say it
 * stays mounted but takes no space (`empty:hidden`), so a live region can be
 * rendered up front and announce what's put in it later.
 */
export function Message({
  tone = "info",
  children,
  className = "",
  ...data
}: {
  tone?: MessageTone;
  children?: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  return (
    <p {...data} role={toneRole(tone)} className={`text-sm empty:hidden ${TEXT[tone]} ${className}`.trim()}>
      {children}
    </p>
  );
}
