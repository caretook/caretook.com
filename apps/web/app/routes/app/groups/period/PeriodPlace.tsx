import type { LocalProvider } from "~/lib/sync/providers";

import { Link } from "react-router";
import { ContactActions, ProviderTypeIcon } from "~/components/providers";
import { appUrls } from "~/lib/appUrls";
import { allActions } from "~/lib/contactActions";

/**
 * Where the period is: the place (a link to its provider page, with every
 * way to reach it: call, email, map, website) and the room or bed. A place
 * deleted from the directory since is greyed "(removed)", with no link or
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
    <section aria-labelledby="period-place-heading" className="space-y-2">
      <h2 id="period-place-heading" className="font-semibold">
        Place
      </h2>
      <div className="rounded-box border-base-300 bg-base-100 flex items-center gap-3 border px-3 py-2.5">
        {place && <ProviderTypeIcon type={place.type} past={removed} />}
        <p className="min-w-0 flex-1 wrap-break-word" data-period-place>
          {place &&
            (removed ? (
              <span className="text-base-content/50" data-place-removed>
                {place.name} (removed)
              </span>
            ) : (
              <Link className="link font-medium" to={appUrls.provider(groupId, place.id)}>
                {place.name}
              </Link>
            ))}
          {place && detail && ", "}
          {detail}
        </p>
        {place && !removed && <ContactActions actions={allActions(place)} />}
      </div>
    </section>
  );
}
