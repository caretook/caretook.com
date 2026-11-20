import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { OlderEntries } from "~/components/entry";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadPast } from "../loadUpcoming";
import { UpcomingFilterChips, UpcomingHeader } from "../UpcomingHeader";
import { emptyPastText, PAST_END_TEXT, parsePastFilters } from "../upcomingFilters";
import { UpcomingList } from "../UpcomingList";
import { usePastEvents } from "../useUpcomingData";

// Shared by web + native. Upcoming's Past tab: past events, newest first,
// cancelled ones included, paged like the timeline. `?author=` filters it.

export const meta = () => [{ title: "Past events · Caretook" }];

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const filters = parsePastFilters(new URL(request.url).search);
  return { ...filters, ...(await loadPast(db, params.groupId, filters)) };
}

/** The live queries follow every change; only a new filter or another page reruns the loader. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function PastEvents({ loaderData, params }: Route.ComponentProps) {
  const { author } = loaderData;
  const { groupId } = params;
  const data = usePastEvents({ groupId, filters: { kind: null, author }, initial: loaderData });
  const authorName = author ? data.nameOf(author) : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-5" data-past-events>
      <UpcomingHeader tab="past" />
      <UpcomingFilterChips
        kind={null}
        kinds={false}
        author={author && authorName ? { name: authorName, image: data.imageOf(author) } : null}
      />
      <UpcomingList data={data} groupId={groupId} label="Past events" empty={emptyPastText(authorName)}>
        <OlderEntries
          hasOlder={data.hasOlder}
          loading={data.loadingOlder}
          empty={data.sections.length === 0}
          onLoadOlder={data.loadOlder}
          endText={PAST_END_TEXT}
        />
      </UpcomingList>
    </main>
  );
}
