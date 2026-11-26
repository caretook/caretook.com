import type { TagTarget } from "@caretook/data/schema";
import type { GroupTagRow, TagRow } from "~/lib/tags/tags.sync";

import { useMemo } from "react";
import { useLiveQuery } from "~/lib/sync";
import { groupRecordTagsQuery, recordTagsQuery, tagsQuery } from "~/lib/tags/tags.sync";

const NO_TAGS: TagRow[] = [];
const NO_LINKS: GroupTagRow[] = [];

/** The group's tags, A to Z, live. */
export function useGroupTags(groupId: string) {
  const q = tagsQuery(groupId);
  return useLiveQuery<TagRow>(q.sql, q.params, NO_TAGS);
}

/** One live record's tags, A to Z, live (none once it's deleted). */
export function useRecordTags(target: TagTarget, recordId: string) {
  const q = recordTagsQuery(target, recordId);
  return useLiveQuery<TagRow>(q.sql, q.params, NO_TAGS);
}

/**
 * Every live record's tags of one type in the group, by record id, live: one
 * query for a whole list, never one per row.
 */
export function useGroupRecordTags(groupId: string, target: TagTarget) {
  const q = groupRecordTagsQuery(groupId, target);
  const rows = useLiveQuery<GroupTagRow>(q.sql, q.params, NO_LINKS);
  return useMemo(() => {
    const byRecord = new Map<string, GroupTagRow[]>();
    for (const row of rows) {
      const list = byRecord.get(row.record_id);
      if (list) list.push(row);
      else byRecord.set(row.record_id, [row]);
    }
    return byRecord;
  }, [rows]);
}
