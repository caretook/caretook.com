import { HeartPulse } from "lucide-react";
import { Link } from "react-router";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useProviderConditions } from "~/lib/profiles/conditionProviders.sync";
import { sinceText } from "~/lib/profiles/conditions";
import { PROFILE_SHEET_STATE } from "~/lib/profiles/profileSheetLink";

/**
 * The conditions this provider diagnosed or manages (conditions slice 3),
 * active first, live (a condition added, resolved or deleted on another
 * device shows without a reload). Each opens its sheet over the profile;
 * closing it comes back here. Nothing shows for a provider with none.
 */
export function ProviderConditions({ groupId, providerId }: { groupId: string; providerId: string }) {
  const conditions = useProviderConditions(groupId, providerId);
  if (conditions.length === 0) return null;

  return (
    <Section title="Conditions" id="conditions" data-provider-conditions="">
      <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
        {conditions.map((c) => {
          const roles = [c.diagnosed && "Diagnosed", c.manages && "Manages"].filter(Boolean).join(" and ");
          const since = sinceText(c);
          return (
            <li key={c.id}>
              <Link
                to={appUrls.condition(groupId, c.id)}
                state={PROFILE_SHEET_STATE}
                className="hover:bg-base-200/50 flex items-center gap-3 px-3 py-2.5"
                data-condition-id={c.id}
              >
                <span
                  aria-hidden="true"
                  className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full"
                >
                  <HeartPulse className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" data-condition-name>
                    {c.name}
                  </span>
                  <span className="text-base-content/70 block text-sm">
                    <span data-condition-role>{roles}</span>
                    {c.status === "resolved" && " · Resolved"}
                    {since && ` · ${since}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
