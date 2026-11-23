import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { listNames } from "~/lib/live-notes/liveNow";
import { useRecentEditors } from "~/lib/live-notes/editors.sync";
import { useMemberLookOf } from "~/lib/care-groups/useMemberLooks";
import { useLiveQuery } from "~/lib/sync";
import { membersQuery } from "~/lib/timeline/timeline.sync";
import { AvatarStack } from "~/components/ui";

const NO_MEMBERS: MemberRow[] = [];

/**
 * An `editors` header region (entry and provider pages): avatars of the other members who
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
  const lookOf = useMemberLookOf();
  if (!editors.length) return null;

  const memberOf = (id: string) => members.find((m) => m.user_id === id);
  const people = editors.map((e) => ({
    id: e.userId,
    name: memberOf(e.userId)?.name || "Someone",
    image: memberOf(e.userId)?.image,
    look: lookOf(e.userId),
  }));
  const label = `${listNames(people.map((p) => p.name))} ${people.length === 1 ? "is" : "are"} editing`;

  // Up to 3, then "+N".
  return <AvatarStack label={label} people={people} max={3} />;
}
