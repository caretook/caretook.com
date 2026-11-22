import { Page } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { TodoUndoStatus } from "~/components/todos";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadUpcoming } from "./loadUpcoming";
import { PlannerFilterRow, PlannerHeader } from "./PlannerHeader";
import { emptyUpcomingText, parseUpcomingFilters } from "./upcomingFilters";
import { UpcomingList } from "./UpcomingList";
import { useUpcomingData } from "./useUpcomingData";

// Shared by web + native. The Planner section's Planner tab (Upcoming):
// appointments (future events), with due doses and dated
// todos merged in by day, read from the device's local
// copy (live, so it works offline and follows other members' changes). What
// counts as upcoming is worked out from the clock (`lib/appointments/upcoming`), never
// stored. `?kind=event` (events only), `?show=todos` (todos only) and `?author=` filter it.

export const meta = () => [{ title: "Planner · Caretook" }];

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

export default function Planner({ loaderData, params }: Route.ComponentProps) {
  const { kind, author, show, todosOnly } = loaderData;
  const { groupId } = params;
  const data = useUpcomingData({ groupId, filters: { kind, author }, todosOnly, initial: loaderData });
  const authorName = author ? data.nameOf(author) : null;

  return (
    <Page data-planner>
      <PlannerHeader />
      <PlannerFilterRow
        view="upcoming"
        show={show}
        author={author && authorName ? { name: authorName, image: data.imageOf(author) } : null}
      />
      {/* Undo after ticking a todo in the list. */}
      <TodoUndoStatus groupId={groupId} />
      <UpcomingList
        data={data}
        groupId={groupId}
        label="Upcoming"
        empty={emptyUpcomingText(show, authorName)}
      />
    </Page>
  );
}
