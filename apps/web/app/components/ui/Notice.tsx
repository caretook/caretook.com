import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { To } from "react-router";
import type { MessageTone } from "./Message";

import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Button } from "./Button";
import { toneRole } from "./Message";

/** A notice's one action: a link, or a callback. */
export type NoticeAction =
  { label: string; to: To; onAction?: never } | { label: string; onAction: () => void; to?: never };

const TONE: Record<MessageTone, { box: string; icon: LucideIcon }> = {
  error: { box: "alert-error", icon: CircleAlert },
  success: { box: "alert-success", icon: CircleCheck },
  warning: { box: "alert-warning", icon: TriangleAlert },
  info: { box: "alert-info", icon: Info },
};

/**
 * A notice box (offline, deleted, needs a connection, "Invite sent"): a soft
 * alert with an icon (the tone's, or `icon`), the text and an optional action.
 * Its role follows the tone, as `Message`'s does.
 */
export function Notice({
  tone = "info",
  role,
  icon,
  action,
  children,
  className = "",
  ...data
}: {
  tone?: MessageTone;
  /**
   * The live-region role, when it must differ from the tone's (a warning that
   * blocks a save); `"none"` for no role at all, inside a caller's own live region that
   * stays mounted (the offline banner).
   */
  role?: "alert" | "status" | "none";
  /** Replaces the tone's icon (decorative: the text says what it is). */
  icon?: LucideIcon;
  action?: NoticeAction;
  children: ReactNode;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  const Icon = icon ?? TONE[tone].icon;
  return (
    <div
      {...data}
      role={role === "none" ? undefined : (role ?? toneRole(tone))}
      className={`alert alert-soft ${TONE[tone].box} items-start text-sm ${className}`.trim()}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 grow">{children}</div>
      {action &&
        (action.to !== undefined ? (
          <Button to={action.to} size="sm">
            {action.label}
          </Button>
        ) : (
          <Button size="sm" onClick={action.onAction}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
