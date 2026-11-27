import type { NoteDocRow } from "~/lib/live-notes/notes.sync";
import type { EntryRow, MemberRow } from "~/lib/timeline/timeline.sync";

import { DEFAULT_UNITS } from "@caretook/data/schema";
import { useMemo } from "react";
import { useGroupRecordTags } from "~/components/tags";
import { EmptyState, List, Section } from "~/components/ui";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveDocuments } from "~/lib/live-notes/editors.sync";
import { liveDotLabel } from "~/lib/live-notes/liveNow";
import { toPreviews } from "~/lib/live-notes/notes.sync";
import { useLiveRows } from "~/lib/sync/useLiveRows";
import { providerEntriesQuery, providerEntryDocumentsQuery } from "~/lib/providers/providers.sync";
import { entryOpen } from "~/lib/timeline/entryOpen";
import { membersQuery, toMember, toTimelineEntries } from "~/lib/timeline/timeline.sync";
// The timeline's own row, so a linked entry looks the same here (B-937).
import { TimelineEntryRow } from "../timeline/TimelineEntryRow";
import { useOpenTodoCounts } from "../timeline/useOpenTodoCounts";

const NO_ROWS: EntryRow[] = [];
const NO_MEMBERS: MemberRow[] = [];
const NO_DOCUMENTS: NoteDocRow[] = [];
/** The live dot needs only who's writing; the banner's title isn't shown here. */
const NO_TITLE = () => "";

/**
 * Every note and event linked to the provider, newest first, live (links
 * made on another device show without a reload), as the timeline's rows:
 * the text, live dot, cancelled badge, open todos, tags and author, with the
 * day over the time (they aren't grouped by day) and no filter links
 * (`elsewhere`). Each opens its entry. The ⋯ menu keeps Print and Copy link;
 * Edit, Cancel, Remind and Delete stay on the timeline and the entry's page.
 * The empty line waits for the query's first answer (`fresh`), and the rows
 * for the members' too, so no author shows as a former member in between.
 */
export function LinkedEntries({ groupId, providerId }: { groupId: string; providerId: string }) {
  const { canWrite, userId } = useGroup();
  const query = providerEntriesQuery(providerId);
  const { rows, fresh } = useLiveRows<EntryRow>(query.sql, query.params, NO_ROWS);
  const membersSql = membersQuery(groupId);
  const members = useLiveRows<MemberRow>(membersSql.sql, membersSql.params, NO_MEMBERS);
  // A note's or event's text is its live document: its preview is the body, as on the timeline.
  const documentsSql = providerEntryDocumentsQuery(providerId);
  const documents = useLiveRows<NoteDocRow>(documentsSql.sql, documentsSql.params, NO_DOCUMENTS);
  const previews = useMemo(() => toPreviews(documents.rows), [documents.rows]);
  const liveDocuments = useLiveDocuments(groupId, userId, NO_TITLE);
  const openTodos = useOpenTodoCounts(groupId);
  const entryTags = useGroupRecordTags(groupId, "entry");

  const people = members.rows.map(toMember);
  const nameOf = (id: string) => people.find((m) => m.userId === id)?.name ?? "Former member";
  const imageOf = (id: string) => people.find((m) => m.userId === id)?.image ?? null;
  const liveLabels = new Map(
    liveDocuments.map((d) => [d.id, liveDotLabel(d.editors.map((e) => nameOf(e.userId)))]),
  );
  const entries = toTimelineEntries(rows).map((entry) => ({
    ...entry,
    body: previews.get(entry.id) || null,
  }));

  return (
    <Section title="Linked entries" id="linked-entries" data-linked-entries="">
      {entries.length === 0
        ? fresh && (
            <EmptyState>
              No notes or events yet. Link this provider from a note or event's With row.
            </EmptyState>
          )
        : members.fresh && (
            <List>
              {entries.map((entry) => (
                <TimelineEntryRow
                  key={entry.id}
                  entry={entry}
                  authorName={nameOf(entry.createdBy)}
                  authorImage={imageOf(entry.createdBy)}
                  // Notes and events only: no readings to show in anyone's units.
                  units={DEFAULT_UNITS}
                  open={entryOpen({ groupId, entry, canWrite, search: "" })}
                  liveLabel={liveLabels.get(entry.id)}
                  openTodos={openTodos.get(entry.id)}
                  tags={entryTags.get(entry.id)}
                  elsewhere
                />
              ))}
            </List>
          )}
    </Section>
  );
}
