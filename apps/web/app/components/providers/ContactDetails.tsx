import type { ContactDetail } from "~/lib/contactActions";

import { ACTION_ICONS, actionLinkProps } from "./ContactActions";

/**
 * A directory row's contact details as visible links: each number with its
 * label, the address (maps) and the email. Each link is named for what it
 * does ("Call Dr. Alvarez, office: (555) 010-2200") and sits above the row's
 * stretched open target (`relative z-10`), so a tap between links still opens
 * the row. Long values truncate rather than widen the row.
 */
export function ContactDetails({ details, muted = false }: { details: ContactDetail[]; muted?: boolean }) {
  if (details.length === 0) return null;
  return (
    <ul
      className={`mt-0.5 flex min-w-0 flex-wrap gap-x-3 text-sm ${muted ? "text-base-content/60" : "text-base-content/80"}`}
      data-contact-details
    >
      {details.map(({ action, text, caption }) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <li key={`${action.kind}:${action.href}`} className="flex max-w-full min-w-0">
            <a
              href={action.href}
              data-action={action.kind}
              className="relative z-10 inline-flex max-w-full min-w-0 items-center gap-1.5 py-1 hover:underline"
              {...actionLinkProps(action)}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="sr-only">{action.label}: </span>
              <span className="truncate">{text}</span>
              {caption && (
                <span aria-hidden="true" className="text-base-content/60 shrink-0 text-xs">
                  {caption}
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
