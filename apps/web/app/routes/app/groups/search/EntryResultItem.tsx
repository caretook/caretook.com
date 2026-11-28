import type { EntryResult, NamedTag } from "./loadSearch";
import type { UnitChoices } from "@caretook/data/schema";

import { Link } from "react-router";
import { EntryBody, KindIcon } from "~/components/entry";
import { KIND_META } from "~/lib/timeline/entryDisplay";
import { entryOpen, SHEET_LINK_STATE } from "~/lib/timeline/entryOpen";
import { formatTime, localTimeZone } from "~/lib/core/format";
import type { ParsedSearch } from "@caretook/data/domain";
import { dayLabel } from "@caretook/data/domain";
import { QuickTags } from "~/components/tags";
import { ROW_CHIPS } from "~/lib/tags/tagPicker";
import { STRETCHED, ROW } from "./resultParts";

/**
 * A timeline entry as a result: its kind, what it says (as on the timeline),
 * when and who. It opens as the timeline would: a note or event's page for
 * everyone, a symptom's, vital's or dose's edit sheet for writers (closing it
 * comes back here), and nothing for a viewer's symptom.
 */
export function EntryResultItem({
  entry,
  groupId,
  canWrite,
  units,
  now,
  search,
  tags,
  tagsReadOnly,
}: {
  entry: EntryResult;
  groupId: string;
  canWrite: boolean;
  units: UnitChoices;
  now: Date;
  search: ParsedSearch;
  /** Its tags, live (`SearchResults`' one query per kind), the ones the text names first. */
  tags: readonly NamedTag[];
  /** Chips only, whoever's looking (the easy roles, as on the Planner). */
  tagsReadOnly: boolean;
  /** A member's name and picture by user id (the group's members, read once by the list; slice 5's rows use them). */
  nameOf: (userId: string) => string;
  imageOf: (userId: string) => string | null;
}) {
  const open = entryOpen({ groupId, entry, canWrite, search: "" });
  const day = dayLabel(entry.occurredAt, localTimeZone(), now);
  const time = entry.allDay ? "all day" : formatTime(entry.occurredAt);
  const name = entry.title || KIND_META[entry.kind].label.toLowerCase();
  return (
    <li
      className={`${ROW} ${open ? "hover:bg-base-200/50" : ""}`}
      data-result="entry"
      data-result-id={entry.id}
      data-opens={open ? (open.sheet ? "sheet" : "page") : "none"}
    >
      {open && (
        <Link
          to={open.to}
          state={open.sheet ? SHEET_LINK_STATE : undefined}
          aria-label={`${open.sheet ? "Edit" : "Open"} ${name}, ${day} at ${time}`}
          className={`absolute inset-0 rounded-[inherit] ${STRETCHED}`}
        />
      )}
      <KindIcon kind={entry.kind} size="sm" />
      <EntryBody
        entry={entry}
        units={units}
        clamp
        providers={entry.providers}
        search={search}
        footer={
          <>
            <p className="text-faint mt-0.5 text-xs">
              <time dateTime={entry.occurredAt}>
                {day}, {time}
              </time>{" "}
              · {entry.authorName}
            </p>
            <QuickTags
              target="entry"
              recordId={entry.id}
              label={name}
              createdBy={entry.createdBy}
              max={ROW_CHIPS}
              tags={tags}
              readOnly={tagsReadOnly}
              className="mt-1"
            />
          </>
        }
      />
    </li>
  );
}
