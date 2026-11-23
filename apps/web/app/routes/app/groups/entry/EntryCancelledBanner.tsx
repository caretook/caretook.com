import type { MemberRow } from "~/lib/timeline/timeline.sync";

import { CalendarX2 } from "lucide-react";
import { Link } from "react-router";
import { Notice, TITLE_SUB } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { cancelledByLine } from "~/lib/appointments/eventCancel";
import { useLiveQuery } from "~/lib/sync";
import { fromLocalTimestamp, membersQuery } from "~/lib/timeline/timeline.sync";
import { useNow } from "~/lib/live-notes/editors.sync";
import { rescheduledLabel } from "~/lib/appointments/upcomingLabels";

const NO_MEMBERS: MemberRow[] = [];
const NO_TARGET: { id: string; occurred_at: string | null }[] = [];
const TARGET_SQL = "SELECT id, occurred_at FROM timeline_entry WHERE id = ? AND deleted_at IS NULL";

/**
 * A cancelled event's banner on its page, for everyone: "Cancelled", the
 * reason when one was given, and who cancelled it and when ("Cancelled by
 * Maria Lopez · Today, 2:15 PM"). After a reschedule that kept it,
 * "Rescheduled to Tue, Dec 1" links to the new event (while that's here and
 * not deleted). Writers get Undo, which puts the event back. Renders nothing
 * while the event isn't cancelled.
 */
export function EntryCancelledBanner({
  groupId,
  cancelledAt,
  cancelledBy,
  cancelReason,
  rescheduledTo,
  onUndo,
}: {
  groupId: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  /** The new event, after a reschedule that kept this one. */
  rescheduledTo: string | null;
  /** Writers only. */
  onUndo?: () => void;
}) {
  const query = membersQuery(groupId);
  const members = useLiveQuery<MemberRow>(query.sql, query.params, NO_MEMBERS);
  const now = useNow(60_000);
  const targets = useLiveQuery<{ id: string; occurred_at: string | null }>(
    TARGET_SQL,
    [rescheduledTo ?? ""],
    NO_TARGET,
  );
  const target = rescheduledTo ? targets.find((t) => t.id === rescheduledTo && t.occurred_at) : undefined;
  if (!cancelledAt) return null;
  const byName = members.find((m) => m.user_id === cancelledBy)?.name || null;

  return (
    <section aria-labelledby="cancelled-heading" data-cancelled-banner>
      <Notice tone="warning" icon={CalendarX2} action={onUndo && { label: "Undo cancel", onAction: onUndo }}>
        <h2 id="cancelled-heading" className={TITLE_SUB}>
          Cancelled
        </h2>
        {cancelReason && (
          <p className="break-words" data-cancel-reason>
            {cancelReason}
          </p>
        )}
        {target?.occurred_at && (
          <p data-rescheduled-to={target.id}>
            <Link to={appUrls.entry(groupId, target.id)} className="link font-medium">
              {rescheduledLabel({ occurredAt: fromLocalTimestamp(target.occurred_at) })}
            </Link>
          </p>
        )}
        <p className="text-muted" data-cancelled-by>
          {cancelledByLine({ cancelledAt, byName }, new Date(now))}
        </p>
      </Notice>
    </section>
  );
}
