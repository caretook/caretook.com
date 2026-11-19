import type { MemberRow } from "~/lib/sync/timeline";

import { CalendarX2 } from "lucide-react";
import { cancelledByLine } from "~/lib/eventCancel";
import { useLiveQuery } from "~/lib/sync";
import { membersQuery } from "~/lib/sync/timeline";
import { useNow } from "~/lib/sync/editors";

const NO_MEMBERS: MemberRow[] = [];

/**
 * A cancelled event's banner on its page, for everyone: "Cancelled", the
 * reason when one was given, and who cancelled it and when ("Cancelled by
 * Maria Lopez · Today, 2:15 PM"). Writers get Undo, which puts the event
 * back. Renders nothing while the event isn't cancelled.
 */
export function EntryCancelledBanner({
  groupId,
  cancelledAt,
  cancelledBy,
  cancelReason,
  onUndo,
}: {
  groupId: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  /** Writers only. */
  onUndo?: () => void;
}) {
  const query = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(query.sql, query.params, NO_MEMBERS);
  const now = useNow(60_000);
  if (!cancelledAt) return null;
  const byName = members.find((m) => m.user_id === cancelledBy)?.name || null;

  return (
    <section
      aria-labelledby="cancelled-heading"
      className="alert alert-warning alert-soft items-start"
      data-cancelled-banner
    >
      <CalendarX2 className="mt-0.5 size-5" aria-hidden="true" />
      <div className="min-w-0">
        <h2 id="cancelled-heading" className="font-semibold">
          Cancelled
        </h2>
        {cancelReason && (
          <p className="break-words" data-cancel-reason>
            {cancelReason}
          </p>
        )}
        <p className="text-sm opacity-80" data-cancelled-by>
          {cancelledByLine({ cancelledAt, byName }, new Date(now))}
        </p>
      </div>
      {onUndo && (
        <button type="button" className="btn btn-sm" onClick={onUndo}>
          Undo cancel
        </button>
      )}
    </section>
  );
}
