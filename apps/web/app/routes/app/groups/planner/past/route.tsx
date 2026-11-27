import { Page } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { useState } from "react";
import { useLocation } from "react-router";
import { OlderEntries } from "~/components/entry";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadPast } from "../loadUpcoming";
import { PlannerHeader } from "../PlannerHeader";
import { pastFilterBar } from "../plannerFilters";
import {
  emptyPastText,
  onlyQueryChanged,
  PAST_END_TEXT,
  parsePastFilters,
  plannerQueryOf,
} from "../upcomingFilters";
import { UpcomingList } from "../UpcomingList";
import { usePastEvents } from "../useUpcomingData";

// Shared by web + native. The Planner's Past tab: past events, newest first,
// cancelled ones included, paged like the timeline. `?author=` (the Filter
// menu's By, or a card's initials), `?tag=` (a chip carried from Upcoming;
// tags PRD) and the search box's `?q=` filter it.

export const meta = () => [{ title: "Past · Caretook" }];

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const { search } = new URL(request.url);
  const filters = parsePastFilters(search);
  return { ...filters, ...(await loadPast(db, params.groupId, filters, plannerQueryOf(search))) };
}

/** The live queries follow every change and the text; only a new filter or another page reruns the loader. */
export function shouldRevalidate({
  formMethod,
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  if (onlyQueryChanged(currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function PastEvents({ loaderData, params }: Route.ComponentProps) {
  const { author, tag } = loaderData;
  const { groupId } = params;
  // The box filters as you type; the URL follows (see `SearchFilterBar`).
  const urlQuery = plannerQueryOf(useLocation().search);
  const [text, setText] = useState(urlQuery);
  const data = usePastEvents({
    groupId,
    filters: { kind: null, author, tag },
    q: text,
    initial: loaderData,
  });
  const authorName = author ? data.nameOf(author) : null;
  const bar = pastFilterBar(
    { value: text, urlQuery, onChange: setText },
    data.members,
    author && authorName ? { userId: author, name: authorName } : null,
    data.tag,
  );

  return (
    <Page data-past-events>
      <PlannerHeader view="past" bar={bar} />
      <UpcomingList
        data={data}
        groupId={groupId}
        label="Past events"
        empty={emptyPastText(authorName, text, data.tag?.name)}
      >
        <OlderEntries
          hasOlder={data.hasOlder}
          loading={data.loadingOlder}
          empty={data.sections.length === 0}
          onLoadOlder={data.loadOlder}
          endText={PAST_END_TEXT}
        />
      </UpcomingList>
    </Page>
  );
}
