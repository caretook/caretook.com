import type { LucideIcon } from "lucide-react";
import type { ContactAction } from "~/lib/providers/contactActions";

import { Globe, Mail, MapPin, MessageSquare, Phone } from "lucide-react";

// A provider's contact actions (`lib/providers/contactActions.ts`) as links: the
// directory's icon buttons and the provider page's labelled list.

export const ACTION_ICONS: Record<ContactAction["kind"], LucideIcon> = {
  call: Phone,
  text: MessageSquare,
  email: Mail,
  map: MapPin,
  website: Globe,
};

/** Maps and websites open outside the app; calls and email hand over to the phone. */
export const opensElsewhere = (action: ContactAction) => action.kind === "map" || action.kind === "website";

/** Link attributes for an action: a new tab (without an opener) for maps and websites. */
export const actionLinkProps = (action: ContactAction) =>
  opensElsewhere(action) ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** One-tap contact links: icon buttons named for what they do ("Call Dr. Alvarez, office"). */
export function ContactActions({ actions }: { actions: ContactAction[] }) {
  if (actions.length === 0) return null;
  return (
    <ul className="relative z-10 flex shrink-0 items-center gap-1" data-contact-actions>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <li key={`${action.kind}:${action.href}`}>
            <a
              href={action.href}
              aria-label={action.label}
              title={action.label}
              data-action={action.kind}
              className="btn btn-ghost btn-sm btn-square"
              {...actionLinkProps(action)}
            >
              <Icon className="size-4" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
