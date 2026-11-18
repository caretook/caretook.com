import type { MyGroup } from "~/lib/rpc";
import type { clientLoader as layoutLoader } from "./route";
import type { GroupRow } from "~/lib/sync/timeline";

import { Check, ChevronDown, Settings } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button, Menu, MenuItem, MenuSection, MenuTrigger, Popover, Separator } from "react-aria-components";
import { useNavigate, useRouteLoaderData } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { rememberGroup } from "~/lib/lastGroup";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, toMyGroup } from "~/lib/sync/timeline";

const ITEM =
  "rounded-field flex cursor-pointer items-center gap-2 px-3 py-2 outline-none data-[focused]:bg-base-200";

/** What a group is called in the header: its recipient (preferred name first), then the group's name. */
const displayName = (group: MyGroup) => group.recipient?.displayName || group.name;

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * The header's `group` region on `/app/groups/:groupId/*`: the current
 * group's display name as a menu listing every group on this device (live,
 * so it works offline), the current one checked. Choosing one opens its
 * timeline; "Group settings" opens the current group's settings. Loading a
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
    <MenuTrigger>
      <Button
        aria-label={`${name}: switch care group`}
        className="btn btn-ghost btn-sm min-w-0 gap-1 px-2 font-semibold"
      >
        <span className="truncate">{name}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </Button>
      <Popover placement="bottom start" className="rounded-box border-base-300 bg-base-100 border shadow-lg">
        <Menu aria-label="Care groups" className="menu w-64 outline-none">
          <MenuSection
            aria-label="Switch care group"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[groupId]}
          >
            {groups.map((group) => (
              <MenuItem
                key={group.id}
                id={group.id}
                textValue={displayName(group)}
                onAction={() => {
                  if (group.id !== groupId) void navigate(appUrls.timeline(group.id));
                }}
                className={ITEM}
              >
                {({ isSelected }) => (
                  <>
                    <Check
                      aria-hidden="true"
                      className={`size-4 shrink-0 ${isSelected ? "" : "invisible"}`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{displayName(group)}</span>
                      {group.recipient && group.name && (
                        <span className="text-base-content/70 block truncate text-sm">{group.name}</span>
                      )}
                    </span>
                  </>
                )}
              </MenuItem>
            ))}
          </MenuSection>
          <Separator className="border-base-300 my-1 border-t" />
          <MenuItem
            id="group-settings"
            onAction={() => void navigate(appUrls.groupSettings(groupId))}
            className={ITEM}
          >
            <Settings aria-hidden="true" className="size-4 shrink-0" />
            Group settings
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
