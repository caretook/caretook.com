import type { UpcomingKind } from "./upcomingFilters";

import { CalendarPlus, NotebookPen, X } from "lucide-react";
import { Link, useLocation } from "react-router";
import { ChipGroup, UserAvatar } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { clearAuthor, clearKind, setKind } from "~/lib/timeline/timelineFilters";
import { tabSearch, UPCOMING_KIND_LABELS, UPCOMING_KINDS } from "./upcomingFilters";

const TAB = "border-b-2 px-1 pb-2 text-sm font-medium";

/**
 * Upcoming's heading, its two tabs (Upcoming, Past: links that carry the
 * filters each reads), and for writers Add appointment and Add reminder,
 * which open a draft with the time picker first (`?when=pick`).
 */
export function UpcomingHeader({ tab }: { tab: "upcoming" | "past" }) {
  const { id: groupId, displayName, canWrite } = useGroup();
  const { search } = useLocation();
  const tabs = [
    { id: "upcoming", label: "Upcoming", to: appUrls.upcoming(groupId, tabSearch(search, "upcoming")) },
    { id: "past", label: "Past", to: appUrls.pastEvents(groupId, tabSearch(search, "past")) },
  ] as const;

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Upcoming</h1>
          <p className="text-base-content/70 text-sm">{displayName}</p>
        </div>
        {canWrite && (
          <div role="group" aria-label="Add to Upcoming" className="flex flex-wrap gap-2" data-upcoming-add>
            <Link to={appUrls.newUpcomingEntry(groupId, "event")} className="btn btn-primary btn-sm">
              <CalendarPlus className="size-4" aria-hidden="true" />
              Add appointment
            </Link>
            <Link to={appUrls.newUpcomingEntry(groupId, "note")} className="btn btn-sm">
              <NotebookPen className="size-4" aria-hidden="true" />
              Add reminder
            </Link>
          </div>
        )}
      </div>
      <nav aria-label="Upcoming or past" className="border-base-300 flex gap-4 border-b" data-upcoming-tabs>
        {tabs.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            aria-current={t.id === tab ? "page" : undefined}
            className={`${TAB} ${t.id === tab ? "border-primary text-base-content" : "text-base-content/70 hover:text-base-content border-transparent"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

/**
 * The filter chips: All, Appointments, Reminders (`?kind=`; left out on the
 * Past tab, which lists events only), and with an author filter on, a last
 * chip that names them and clears it.
 */
export function UpcomingFilterChips({
  kind,
  author,
  kinds = true,
}: {
  kind: UpcomingKind | null;
  author: { name: string; image: string | null } | null;
  kinds?: boolean;
}) {
  const { search } = useLocation();
  const links = [
    ...(kinds
      ? [
          { id: "all", label: "All", to: { search: clearKind(search) }, current: !kind },
          ...UPCOMING_KINDS.map((k) => ({
            id: k,
            label: UPCOMING_KIND_LABELS[k],
            to: { search: setKind(search, k) },
            current: kind === k,
          })),
        ]
      : []),
    ...(author
      ? [
          {
            id: "author",
            label: `By ${author.name}`,
            name: `By ${author.name}: clear this filter`,
            to: { search: clearAuthor(search) },
            current: true,
            leading: <UserAvatar name={author.name} image={author.image} size="xs" className="-ml-1.5" />,
            trailing: <X className="size-3.5" aria-hidden="true" />,
          },
        ]
      : []),
  ];
  if (links.length === 0) return null;
  return <ChipGroup label="Show items" replace preventScrollReset links={links} />;
}
