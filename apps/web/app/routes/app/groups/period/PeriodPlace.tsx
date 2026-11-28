import type { LocalProvider } from "~/lib/providers/providers.sync";

import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { LINK, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { placeName } from "~/lib/care-periods/periodPlaces";
import { allActions } from "~/lib/providers/contactActions";

/**
 * Where the period is: the place (a link to its provider page, with every
 * way to reach it: call, email, map, website) and the room or bed. A place
 * deleted from the directory since is greyed "Removed place", with no link or
 * actions. Nothing when neither is set.
 */
export function PeriodPlace({
  groupId,
  place,
  detail,
}: {
  groupId: string;
  place: LocalProvider | null;
  detail: string | null;
}) {
  if (!place && !detail) return null;
  const removed = !!place?.deletedAt;
  return (
    <Section title="Place" id="place">
      <div className="rounded-box border-base-300 bg-base-100 flex items-center gap-3 border px-3 py-2.5">
        {place && <ProviderTypeIcon type={place.type} past={removed} />}
        <p className="min-w-0 flex-1 wrap-break-word" data-period-place>
          {place &&
            (removed ? (
              <span className="text-faint" data-place-removed>
                {placeName(place)}
              </span>
            ) : (
              <Link className={`${LINK} font-medium`} to={appUrls.provider(groupId, place.id)}>
                {place.name}
              </Link>
            ))}
          {place && detail && ", "}
          {detail}
        </p>
        {place && !removed && <ContactActions actions={allActions(place)} />}
      </div>
    </Section>
  );
}
