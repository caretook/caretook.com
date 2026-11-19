import type { MyGroup } from "~/lib/rpc";
import type { clientLoader as layoutLoader } from "./route";
import type { GroupRow } from "~/lib/sync/timeline";

import { ChevronDown, Plus, Settings } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { Menu, SEPARATOR } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { rememberGroup } from "~/lib/lastGroup";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, toMyGroup } from "~/lib/sync/timeline";
import { NEW_GROUP_LINK_STATE } from "../groups/new/newGroupLink";

/** What a group is called in the header: its recipient (preferred name first), then the group's name. */
const displayName = (group: MyGroup) => group.recipient?.displayName || group.name;

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * The header's `group` region on `/app/groups/:groupId/*`: the current
 * group's display name as a menu listing every group on this device (live,
 * so it works offline), the current one checked. Choosing one opens its
 * timeline; "Group settings" opens the current group's settings, and "New
 * care group" the New care group sheet (closing it comes back). Loading a
 * group route also remembers it for `/app`.
 */
export function GroupMenu({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  // The signed-in user from the /app layout's loader (not `getSync()`, which
  // throws while signing out, when the database closes under this header).
  const userId = useRouteLoaderData<typeof layoutLoader>("app")?.user.id ?? "";
  const query = useMemo(() => myGroupsQuery(userId), [userId]);
  const groups = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS).map(toMyGroup);
  const current = groups.find((g) => g.id === groupId);

  // Only a group you're in is remembered (a stale link to another one isn't).
  const isMember = !!current;
  useEffect(() => {
    if (isMember && userId) rememberGroup(userId, groupId);
  }, [isMember, userId, groupId]);

  if (!current) return null;
  const name = displayName(current);

  return (
    <Menu
      label={`${name}: switch care group`}
      menuLabel="Care groups"
      className="btn btn-ghost btn-sm min-w-0 gap-1 px-2 font-semibold"
      placement="bottom start"
      width="lg"
      items={[
        {
          type: "section",
          id: "groups",
          ariaLabel: "Switch care group",
          items: groups.map((group) => ({
            id: group.id,
            label: displayName(group),
            description: group.recipient && group.name ? group.name : undefined,
          })),
          selection: { selected: groupId, onChange: (id) => void navigate(appUrls.timeline(id)) },
        },
        SEPARATOR,
        {
          id: "group-settings",
          label: "Group settings",
          icon: Settings,
          href: appUrls.groupSettings(groupId),
        },
        {
          id: "new-group",
          label: "New care group",
          icon: Plus,
          href: appUrls.newGroup(),
          state: NEW_GROUP_LINK_STATE,
        },
      ]}
    >
      <span className="truncate">{name}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </Menu>
  );
}
