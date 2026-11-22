import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { To } from "react-router";

import { Button } from "./Button";

/** The way to add the first one: a link, or a callback (opening a sheet). */
export type EmptyStateAction =
  | { label: string; to: To; icon?: LucideIcon; onAction?: never }
  | { label: string; onAction: () => void; icon?: LucideIcon; to?: never };

/**
 * A list with nothing in it: one quiet line ("No one is waiting."), and an
 * action to add the first one where the viewer may.
 */
export function EmptyState({
  children,
  action,
  className = "",
  ...data
}: {
  children: ReactNode;
  action?: EmptyStateAction;
  /** Classes for the outer element (a margin), never its look. */
  className?: string;
  /** Data hooks (`data-*`). */
  [attr: `data-${string}`]: string | undefined;
}) {
  return (
    <div {...data} className={`space-y-2 ${className}`.trim()}>
      <p className="text-base-content/70 text-sm">{children}</p>
      {action &&
        (action.to !== undefined ? (
          <Button to={action.to} size="sm" icon={action.icon}>
            {action.label}
          </Button>
        ) : (
          <Button size="sm" icon={action.icon} onClick={action.onAction}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
