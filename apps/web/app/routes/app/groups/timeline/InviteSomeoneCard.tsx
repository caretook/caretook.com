import { isManagerRole } from "@caretook/data/permissions";
import { UserPlus } from "lucide-react";
import { Button, Card } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { useGroup } from "~/lib/app-shell/group";
import { useLiveQuery } from "~/lib/sync";

// The prompt on a new group's timeline: while its owners and admins are the
// only one in it, invite the others who help (Members, in group settings).
// Live from the local copy, so it goes once someone joins.

/** Until the query reports: unknown, so the card stays hidden. Stable (useLiveQuery compares it). */
const UNKNOWN: { others: number }[] = [{ others: -1 }];

const othersQuery = (groupId: string, userId: string) => ({
  sql: `SELECT count(*) AS others FROM care_group_member WHERE group_id = ? AND user_id != ?`,
  params: [groupId, userId],
});

export function InviteSomeoneCard({ className = "" }: { className?: string }) {
  const { id, userId, role, displayName } = useGroup();
  const query = othersQuery(id, userId);
  const [row] = useLiveQuery<{ others: number }>(query.sql, query.params, UNKNOWN);
  if (!isManagerRole(role) || (row?.others ?? -1) !== 0) return null;
  return (
    <Card title="Invite someone" headingId="invite-someone" className={className} data-invite-card="">
      <p className="text-muted text-sm">
        You're the only one in {displayName ? `${displayName}'s` : "this"} care group. Invite family and
        helpers so you can share what's going on.
      </p>
      <Button
        to={appUrls.groupSettings(id, "members")}
        variant="primary"
        size="sm"
        icon={UserPlus}
        className="w-fit"
      >
        Invite someone
      </Button>
    </Card>
  );
}
