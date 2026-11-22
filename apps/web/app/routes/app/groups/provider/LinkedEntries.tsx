import type { EntryRow } from "~/lib/timeline/timeline.sync";

import { Link } from "react-router";
import { KindIcon } from "~/components/entry";
import { Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { formatDay, formatTime } from "~/lib/core/format";
import { useLiveQuery } from "~/lib/sync";
import { providerEntriesQuery } from "~/lib/providers/providers.sync";
import { toTimelineEntries } from "~/lib/timeline/timeline.sync";

const NO_ROWS: EntryRow[] = [];

/**
 * Every note and event linked to the provider, newest first, live (links
 * made on another device show without a reload). Each opens its entry.
 */
export function LinkedEntries({ groupId, providerId }: { groupId: string; providerId: string }) {
  const query = providerEntriesQuery(providerId);
  const rows = useLiveQuery<EntryRow>(query.sql, query.params, NO_ROWS);
  const entries = toTimelineEntries(rows);

  return (
    <Section title="Linked entries" id="linked-entries" data-linked-entries="">
      {entries.length === 0 ? (
        <p className="text-base-content/70 text-sm">
          No notes or events yet. Link this provider from a note or event's With row.
        </p>
      ) : (
        <ul className="rounded-box border-base-300 bg-base-100 divide-base-200 divide-y overflow-hidden border">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={appUrls.entry(groupId, entry.id)}
                className="hover:bg-base-200/50 flex items-center gap-3 px-3 py-2.5"
                data-entry-id={entry.id}
              >
                <KindIcon kind={entry.kind} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{entry.title || KIND_META[entry.kind].label}</span>
                  <span className="text-base-content/70 block text-sm">
                    <span className="sr-only">{KIND_META[entry.kind].label}, </span>
                    <time dateTime={entry.occurredAt}>
                      {formatDay(entry.occurredAt)}, {formatTime(entry.occurredAt)}
                    </time>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
