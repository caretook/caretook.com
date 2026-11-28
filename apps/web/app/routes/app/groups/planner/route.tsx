import { Page, PageHeader } from "~/components/ui";
import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { useState } from "react";
import { useLocation } from "react-router";
import { TodoUndoStatus } from "~/components/todos";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadUpcoming } from "./loadUpcoming";
import { PlannerHeader } from "./PlannerHeader";
import { upcomingFilterBar } from "./plannerFilters";
import { emptyUpcomingText, onlyQueryChanged, parseUpcomingFilters, plannerQueryOf } from "./upcomingFilters";
import { UpcomingList } from "./UpcomingList";
import { useUpcomingData } from "./useUpcomingData";

// Shared by web + native. The Planner section's Upcoming tab:
// appointments (future events), with due doses and dated
// todos merged in by day, read from the device's local
// copy (live, so it works offline and follows other members' changes). What
// counts as upcoming is worked out from the clock (`lib/appointments/upcoming`), never
// stored. `?kind=event` (events only), `?show=todos` (todos only), `?author=`,
// `?tag=` (events and todos; tags PRD) and the search box's `?q=` filter it;
// `?subtasks=own` lists each dated todo on its own row (todo-links-2).
// For the easy roles it's the list alone, read-only: no Add, tabs, filters
// or row menus (they tick only their own todos).

export const meta = () => [{ title: "Planner · Caretook" }];

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  // The easy roles have no filters: a typed one is ignored.
  const filters = parseUpcomingFilters(group.easyRole ? "" : new URL(request.url).search);
  return { ...filters, ...(await loadUpcoming(db, params.groupId, filters)) };
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

export default function Planner({ loaderData, params }: Route.ComponentProps) {
  const { kind, author, show, todosOnly, tag, view } = loaderData;
  const { groupId } = params;
  const { easyRole } = useGroup();
  // The box filters as you type; the URL follows (see `SearchFilterBar`). The easy roles have no box.
  const urlQuery = plannerQueryOf(useLocation().search);
  const [typed, setText] = useState(urlQuery);
  const text = easyRole ? "" : typed;
  const data = useUpcomingData({
    groupId,
    filters: { kind, author, tag },
    todosOnly,
    view,
    q: text,
    initial: loaderData,
  });
  const authorName = author ? data.nameOf(author) : null;

  return (
    <Page data-planner>
      {easyRole ? (
        <PageHeader title="Planner" />
      ) : (
        <PlannerHeader
          view="upcoming"
          bar={upcomingFilterBar(
            { value: text, urlQuery, onChange: setText },
            show,
            author && authorName ? { userId: author, name: authorName, image: data.imageOf(author) } : null,
            data.tags,
            view,
          )}
        />
      )}
      {/* Undo after ticking a todo in the list. */}
      <TodoUndoStatus groupId={groupId} />
      <UpcomingList
        data={data}
        groupId={groupId}
        label="Upcoming"
        empty={emptyUpcomingText(show, authorName, text, data.tag?.name)}
        readOnly={easyRole}
      />
    </Page>
  );
}
