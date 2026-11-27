import type { ContactDetail } from "~/lib/providers/contactActions";
import type { LocalProvider } from "~/lib/providers/providers.sync";

import { ACTION_ICONS, actionLinkProps } from "~/components/providers";
import { Button } from "~/components/ui";
import { rowContact } from "~/lib/providers/contactActions";

/**
 * A Full row's contact line (B-940): the first number and the address as
 * readable links (to read aloud to a front desk), then an email icon button.
 * Each sits above the row's stretched name link (`relative z-10`), is at
 * least 44px tall, and wraps rather than truncates. Nothing when there's
 * nothing to reach.
 */
export function ProviderRowContact({ provider, past }: { provider: LocalProvider; past: boolean }) {
  const { call, map, email } = rowContact(provider);
  if (!call && !map && !email) return null;
  return (
    <ul
      className={`flex min-w-0 flex-wrap items-center gap-x-3 text-sm ${past ? "text-faint" : "text-muted"}`}
      data-row-contact
    >
      {call && <DetailLink detail={call} />}
      {map && <DetailLink detail={map} />}
      {email && (
        <li>
          <Button
            href={email.href}
            variant="ghost"
            icon={ACTION_ICONS.email}
            label={email.label}
            className={`relative z-10 size-11 ${past ? "text-faint" : ""}`}
            data-action="email"
          />
        </li>
      )}
    </ul>
  );
}

function DetailLink({ detail: { action, text, caption } }: { detail: ContactDetail }) {
  const Icon = ACTION_ICONS[action.kind];
  return (
    <li className="flex max-w-full min-w-0">
      <a
        href={action.href}
        data-action={action.kind}
        className="relative z-10 inline-flex min-h-11 max-w-full min-w-0 items-center gap-1.5 hover:underline"
        {...actionLinkProps(action)}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        <span className="sr-only">{action.label}: </span>
        <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        {caption && (
          <span aria-hidden="true" className="text-faint shrink-0 text-xs">
            {caption}
          </span>
        )}
      </a>
    </li>
  );
}
