import type { ContactAction } from "~/lib/providers/contactActions";

import { ACTION_ICONS, actionLinkProps } from "~/components/providers";
import { Button } from "~/components/ui";

/** What a footer button says; its full name ("Call Dr. Tran, Office") is the action's label. */
const FOOTER_LABELS: Partial<Record<ContactAction["kind"], string>> = { call: "Call", map: "Directions" };

/** A Planner card's labelled footer actions, above the row's open target. */
export function UpcomingRowActions({ actions }: { actions: ContactAction[] }) {
  return (
    <ul className="relative z-10 -ml-2 flex min-w-0 flex-wrap items-center gap-1" data-contact-actions>
      {actions.map((action) => (
        // The tooltip sits on the item: a `Button` with text takes no `title`.
        <li key={`${action.kind}:${action.href}`} title={action.label}>
          <Button
            href={action.href}
            variant="ghost"
            size="sm"
            icon={ACTION_ICONS[action.kind]}
            aria-label={action.label}
            data-action={action.kind}
            className="gap-1.5 px-2"
            {...actionLinkProps(action)}
          >
            <span aria-hidden="true">{FOOTER_LABELS[action.kind]}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
