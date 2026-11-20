import { UserPlus } from "lucide-react";
import { Link } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";

// The prompt on a new group's timeline: while its owners and admins are the
// only one in it, invite the others who help (Members, in group settings).
// Live from the local copy, so it goes once someone joins.

const MANAGERS = ["owner", "admin"];

/** Until the query reports: unknown, so the card stays hidden. Stable (useLiveQuery compares it). */
const UNKNOWN: { others: number }[] = [{ others: -1 }];

const othersQuery = (groupId: string, userId: string) => ({
  sql: `SELECT count(*) AS others FROM care_group_member WHERE group_id = ? AND user_id != ?`,
  params: [groupId, userId],
});

export function InviteSomeoneCard() {
  const { id, userId, role, displayName } = useGroup();
  const query = othersQuery(id, userId);
  const [row] = useLiveQuery<{ others: number }>(query.sql, query.params, UNKNOWN);
  if (!role || !MANAGERS.includes(role) || (row?.others ?? -1) !== 0) return null;
  return (
    <section
      className="card bg-base-100 border-base-300 border"
      aria-labelledby="invite-someone"
      data-invite-card=""
    >
      <div className="card-body gap-2 p-4">
        <h2 id="invite-someone" className="card-title text-base">
          Invite someone
        </h2>
        <p className="text-base-content/70 text-sm">
          You're the only one in {displayName ? `${displayName}'s` : "this"} care group. Invite family and
          helpers so you can share what's going on.
        </p>
        <Link to={appUrls.groupSettings(id, "members")} className="btn btn-primary btn-sm w-fit">
          <UserPlus aria-hidden="true" className="size-4" />
          Invite someone
        </Link>
      </div>
    </section>
  );
}
