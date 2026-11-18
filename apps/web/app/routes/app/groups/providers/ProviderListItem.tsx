import type { ProviderType } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";
import type { ContactAction } from "~/lib/contactActions";
import type { LocalProvider } from "~/lib/sync/providers";

import { Building2, Globe, Mail, MapPin, Phone, Pill, Stethoscope, UserRound } from "lucide-react";
import { quickActions } from "~/lib/contactActions";
import { PROVIDER_TYPE_META } from "~/lib/providerDirectory";

const TYPE_ICONS: Record<ProviderType, LucideIcon> = {
  clinician: Stethoscope,
  practice: Building2,
  pharmacy: Pill,
  other: UserRound,
};

const ACTION_ICONS: Record<ContactAction["kind"], LucideIcon> = {
  call: Phone,
  email: Mail,
  map: MapPin,
  website: Globe,
};

/** Maps and websites open outside the app; calls and email hand over to the phone. */
const opensElsewhere = (action: ContactAction) => action.kind === "map" || action.kind === "website";

/** One-tap contact links: icon buttons named for what they do ("Call Dr. Alvarez, office"). */
export function ContactActions({ actions }: { actions: ContactAction[] }) {
  if (actions.length === 0) return null;
  return (
    <ul className="flex shrink-0 items-center gap-1" data-contact-actions>
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
              {...(opensElsewhere(action) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <Icon className="size-4" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A provider in the directory: what they are, the badges, and the quick
 * contact actions. (Opening their page comes with the provider page.)
 */
export function ProviderListItem({
  provider,
  practiceName,
}: {
  provider: LocalProvider;
  practiceName: string | null;
}) {
  const Icon = TYPE_ICONS[provider.type];
  const past = provider.status === "past";
  const details = [PROVIDER_TYPE_META[provider.type].label, provider.specialty, practiceName].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5" data-provider-id={provider.id}>
      <span
        aria-hidden="true"
        className={`bg-base-200 text-base-content grid size-9 shrink-0 place-items-center rounded-full ${past ? "opacity-60" : ""}`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5">
          <span className={`truncate font-medium ${past ? "text-base-content/70" : ""}`} data-provider-name>
            {provider.name}
          </span>
          {provider.isPrimary && !past && (
            <span className="badge badge-primary badge-sm shrink-0">Primary</span>
          )}
          {past && <span className="badge badge-ghost badge-sm shrink-0">Past</span>}
        </p>
        <p className="text-base-content/70 truncate text-sm">{details.join(" · ")}</p>
      </div>
      <ContactActions actions={quickActions(provider)} />
    </li>
  );
}
