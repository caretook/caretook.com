import type { ContactAction } from "~/lib/providers/contactActions";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { ACTION_ICONS, actionLinkProps } from "~/components/providers";
import { List, Section } from "~/components/ui";
import { allActions, callAction } from "~/lib/providers/contactActions";

const CAPTIONS: Record<Exclude<ContactAction["kind"], "call">, string> = {
  text: "Text",
  email: "Email",
  map: "Address",
  website: "Website",
};

/**
 * Every way to reach the provider, each with what it is under its value:
 * each number with its label, then email, address (maps) and website.
 */
const contactRows = (provider: LocalProvider) => [
  ...provider.phones.flatMap((phone) => {
    const action = callAction(provider.name, phone);
    return action ? [{ action, caption: phone.label.trim() || "Phone" }] : [];
  }),
  ...allActions(provider).flatMap((action) =>
    action.kind === "call" ? [] : [{ action, caption: CAPTIONS[action.kind] }],
  ),
];

/** The contact list: one link per way to reach them, named for what it does ("Call Dr. Alvarez, office"). */
export function ContactList({ provider }: { provider: LocalProvider }) {
  const rows = contactRows(provider);
  if (rows.length === 0) return null;
  return (
    <Section title="Contact" id="contact">
      <List label="Contact" data-contact-list="">
        {rows.map(({ action, caption }) => {
          const Icon = ACTION_ICONS[action.kind];
          return (
            <li key={`${action.kind}:${action.href}`}>
              <a
                href={action.href}
                data-action={action.kind}
                className="hover:bg-base-200/50 flex items-center gap-3 px-3 py-2.5"
                {...actionLinkProps(action)}
              >
                <Icon className="text-muted size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="sr-only">{action.label}: </span>
                  <span className="block break-words whitespace-pre-line">{action.value}</span>
                  <span aria-hidden="true" className="text-muted block text-sm">
                    {caption}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </List>
    </Section>
  );
}
