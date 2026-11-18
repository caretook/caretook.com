import type { MemberRow } from "~/lib/sync/timeline";

import { initials } from "~/lib/entryDisplay";
import { listNames } from "~/lib/liveNow";
import { useRecentEditors } from "~/lib/sync/editors";
import { useLiveQuery } from "~/lib/sync";
import { membersQuery } from "~/lib/sync/timeline";

const NO_MEMBERS: MemberRow[] = [];
/** More than this many, and the rest become "+N". */
const MAX_SHOWN = 3;

/**
 * The entry header's `editors` region: initials of the other members who
 * edited this document in the last couple of minutes, most recent first.
 * Updates live as edits arrive, and expires on the recent-editors timer.
 * Renders nothing when nobody else is typing (or for the viewer alone).
 */
export function EditorAvatars({
  documentId,
  groupId,
  viewerId,
}: {
  documentId: string;
  groupId: string;
  viewerId: string;
}) {
  const editors = useRecentEditors(documentId, viewerId);
  const query = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(query.sql, query.params, NO_MEMBERS);
  if (!editors.length) return null;

  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.name || "Someone";
  const names = editors.map((e) => nameOf(e.userId));
  const shown = editors.slice(0, MAX_SHOWN);
  const extra = editors.length - shown.length;
  const label = `${listNames(names)} ${names.length === 1 ? "is" : "are"} editing`;

  return (
    <div role="group" aria-label={label} title={label} className="flex items-center -space-x-1.5">
      {shown.map((e) => (
        <span
          key={e.userId}
          data-editor={e.userId}
          aria-hidden="true"
          className="bg-primary text-primary-content ring-base-100 inline-flex size-7 items-center justify-center rounded-full text-[0.7rem] font-semibold ring-2"
        >
          {initials(nameOf(e.userId)) || "?"}
        </span>
      ))}
      {extra > 0 && (
        <span
          aria-hidden="true"
          className="bg-base-300 text-base-content ring-base-100 inline-flex size-7 items-center justify-center rounded-full text-[0.7rem] font-semibold ring-2"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
