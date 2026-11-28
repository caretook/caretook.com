import type { EntryResult, NamedTag } from "./loadSearch";
import type { UnitChoices } from "@caretook/data/schema";
import type { ParsedSearch } from "@caretook/data/domain";

import { TimelineEntryRow } from "~/components/entry";
import { entryOpen } from "~/lib/timeline/entryOpen";

/**
 * A timeline entry as a result: the timeline's own row (`TimelineEntryRow`,
 * `elsewhere`: the day over the time, a plain kind icon and author), its
 * matches marked. It opens as the timeline would (`entryOpen`): a note or
 * event's page for everyone, a symptom's, vital's or dose's edit sheet for
 * writers (closing it comes back here), and nothing for a viewer's symptom.
 * No Edit or Delete: the ⋯ keeps Copy link and Print.
 */
export function EntryResultItem({
  entry,
  groupId,
  canWrite,
  units,
  search,
  tags,
  tagsReadOnly,
  nameOf,
  imageOf,
}: {
  entry: EntryResult;
  groupId: string;
  canWrite: boolean;
  units: UnitChoices;
  search: ParsedSearch;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** A member's name and picture by user id (the group's members, read once by the list). */
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
}) {
  const open = entryOpen({ groupId, entry, canWrite, search: "" });
  return (
    <TimelineEntryRow
      entry={entry}
      authorName={nameOf(entry.createdBy)}
      authorImage={imageOf(entry.createdBy)}
      units={units}
      open={open}
      providers={entry.providers}
      search={search}
      tags={tags}
      tagsReadOnly={tagsReadOnly}
      elsewhere
      data-result="entry"
      data-result-id={entry.id}
      data-opens={open ? (open.sheet ? "sheet" : "page") : "none"}
    />
  );
}
