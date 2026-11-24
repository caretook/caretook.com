import type { MemberContactLine } from "~/lib/profiles/memberContact";

import { ACTION_ICONS, actionLinkProps } from "~/components/providers";
import { Button } from "~/components/ui";

/** `data-*` attributes for the list (what checks find it by). */
type DataAttributes = { [name: `data-${string}`]: string };

/**
 * Someone's contact details as links (a member's shared details, the
 * recipient's contact): each number (call, and a text button beside it), the
 * email and the address (maps). Each link is named for what it does ("Call
 * Sam, mobile: (555) 010-1234").
 */
export function ContactLines({ lines, ...data }: { lines: MemberContactLine[] } & DataAttributes) {
  if (lines.length === 0) return null;
  return (
    <ul className="text-muted flex min-w-0 flex-col gap-0.5 text-sm" {...data}>
      {lines.map(({ field, action, text, caption, sms }) => {
        const Icon = ACTION_ICONS[action.kind];
        return (
          <li
            key={`${action.kind}:${action.href}`}
            data-shared={field}
            className="flex min-w-0 items-center gap-1"
          >
            <a
              href={action.href}
              data-action={action.kind}
              className="inline-flex max-w-full min-w-0 items-center gap-1.5 py-1 hover:underline"
              {...actionLinkProps(action)}
            >
              <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
              <span className="sr-only">{action.label}: </span>
              <span className="truncate">{text}</span>
              {caption && (
                <span aria-hidden="true" className="text-faint shrink-0 text-xs">
                  {caption}
                </span>
              )}
            </a>
            {sms && <TextLink action={sms} />}
          </li>
        );
      })}
    </ul>
  );
}

function TextLink({ action }: { action: NonNullable<MemberContactLine["sms"]> }) {
  return (
    <Button
      href={action.href}
      variant="ghost"
      size="xs"
      icon={ACTION_ICONS.text}
      label={action.label}
      data-action="text"
      className="shrink-0"
    />
  );
}
