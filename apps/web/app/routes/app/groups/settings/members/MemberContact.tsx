import type { MemberContactLine } from "~/lib/memberContact";

import { ACTION_ICONS, actionLinkProps } from "~/components/providers";

/**
 * What a member shares with the group, as links: each number (call, and a
 * text button beside it), the email and the address (maps). Each link is
 * named for what it does ("Call Sam, mobile: (555) 010-1234").
 */
export function MemberContact({ lines }: { lines: MemberContactLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="text-base-content/80 flex min-w-0 flex-col gap-0.5 text-sm" data-member-contact="">
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
                <span aria-hidden="true" className="text-base-content/60 shrink-0 text-xs">
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
  const Icon = ACTION_ICONS.text;
  return (
    <a
      href={action.href}
      aria-label={action.label}
      title={action.label}
      data-action="text"
      className="btn btn-ghost btn-xs btn-square shrink-0"
    >
      <Icon className="size-3.5" aria-hidden="true" />
    </a>
  );
}
