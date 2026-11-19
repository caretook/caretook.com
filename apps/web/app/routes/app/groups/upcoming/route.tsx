import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { getGroup } from "~/lib/group";
import { sessionContext } from "~/lib/session";
import { loadUpcoming } from "./loadUpcoming";
import { UpcomingFilterChips, UpcomingHeader } from "./UpcomingHeader";
import { emptyUpcomingText, parseUpcomingFilters } from "./upcomingFilters";
import { UpcomingList } from "./UpcomingList";
import { useUpcomingData } from "./useUpcomingData";

// Shared by web + native. The group's Upcoming section: appointments
// (future events) and reminders (future notes), read from the device's local
// copy (live, so it works offline and follows other members' changes). What
// counts as upcoming is worked out from the clock (`lib/upcoming`), never
// stored. `?kind=` (event or note) and `?author=` filter it, as on the timeline.

export const meta = () => [{ title: "Upcoming · Caretook" }];

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const filters = parseUpcomingFilters(new URL(request.url).search);
  return { ...filters, ...(await loadUpcoming(db, params.groupId, filters)) };
}

/** The live queries follow every change; only a new filter or another page reruns the loader. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function Upcoming({ loaderData, params }: Route.ComponentProps) {
  const { kind, author } = loaderData;
  const { groupId } = params;
  const data = useUpcomingData({ groupId, filters: { kind, author }, initial: loaderData });
  const authorName = author ? data.nameOf(author) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-upcoming>
      <UpcomingHeader tab="upcoming" />
      <UpcomingFilterChips
        kind={kind}
        author={author && authorName ? { name: authorName, image: data.imageOf(author) } : null}
      />
      <UpcomingList
        data={data}
        groupId={groupId}
        label="Upcoming"
        empty={emptyUpcomingText(kind, authorName)}
      />
    </main>
  );
}
