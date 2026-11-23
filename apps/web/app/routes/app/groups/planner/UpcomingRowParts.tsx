import type { ContactAction } from "~/lib/providers/contactActions";

import { AuthorFilterLink } from "~/components/entry";
import { ACTION_ICONS, actionLinkProps } from "~/components/providers";
import { initials } from "~/lib/timeline/entryDisplay";

/** What a footer button says; its full name ("Call Dr. Tran, Office") is the action's label. */
const FOOTER_LABELS: Partial<Record<ContactAction["kind"], string>> = { call: "Call", map: "Directions" };

/** A Planner card's labelled footer actions, above the row's open target. */
export function UpcomingRowActions({ actions }: { actions: ContactAction[] }) {
  return (
    <ul className="relative z-10 -ml-2 flex min-w-0 flex-wrap items-center gap-1" data-contact-actions>
      {actions.map((action) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <li key={`${action.kind}:${action.href}`}>
            <a
              href={action.href}
              aria-label={action.label}
              title={action.label}
              data-action={action.kind}
              className="btn btn-ghost btn-sm gap-1.5 px-2"
              {...actionLinkProps(action)}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span aria-hidden="true">{FOOTER_LABELS[action.kind]}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A Planner card's author initials: a filter link, or for `readOnly` (the easy
 * roles) plain initials, so a tap on them opens the row.
 */
export function UpcomingRowAuthor({
  userId,
  name,
  image,
  readOnly,
}: {
  userId: string;
  name: string;
  image: string | null;
  readOnly: boolean;
}) {
  if (!readOnly) {
    return <AuthorFilterLink userId={userId} name={name} initials={initials(name)} image={image} />;
  }
  return (
    <span
      className="bg-base-200 text-base-content/80 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-semibold"
      title={name}
      data-author={userId}
    >
      <span aria-hidden="true">{initials(name)}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}
