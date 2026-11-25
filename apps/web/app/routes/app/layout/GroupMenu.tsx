import type { GroupContext } from "~/lib/app-shell/groupContext";
import type { MyGroup } from "~/lib/core/rpc";
import type { clientLoader as layoutLoader } from "./route";
import type { GroupRow } from "~/lib/timeline/timeline.sync";

import { ChevronDown, MapPin, Plus, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useNavigation, useRouteLoaderData } from "react-router";
import { Menu, SEPARATOR } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { rememberGroup } from "~/lib/app-shell/lastGroup";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, toMyGroup } from "~/lib/timeline/timeline.sync";
import { NEW_GROUP_LINK_STATE } from "~/lib/care-groups/newGroupLink";
import { periodName, periodTypeMeta } from "~/lib/care-periods/periodDisplay";
import { useCurrentCarePeriod } from "~/lib/care-periods/currentPeriod.sync";

/** What a group is called in the header: its recipient (preferred name first), then the group's name. */
const displayName = (group: MyGroup) => group.recipient?.displayName || group.name;

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * The header's `group` region on `/app/groups/:groupId/*`: the current
 * group's display name as a menu listing every group on this device (live,
 * so it works offline), the current one checked. Choosing one opens its
 * timeline; "New care group" opens the New care group sheet (closing it
 * comes back); then, after a separator, "<Name>'s profile", "Care periods"
 * and "Group settings" (last). Loading a group route also remembers it for
 * `/app`.
 *
 * With a care period, the button shows the current period's type icon after
 * the name (the period's name as its text and hover hint).
 *
 * While a navigation into one of the menu's destinations is pending (the menu
 * has closed, the target's loader is slow), the button's chevron is a small
 * spinner (`data-pending`), so the tap shows it registered.
 *
 * Until the device's list answers (a moment after the page renders), the
 * group route's own copy of the current group stands in, so the header never
 * shows without its group menu.
 */
export function GroupMenu({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pendingPath = useNavigation().location?.pathname;
  // The signed-in user from the /app layout's loader (not `getSync()`, which
  // throws while signing out, when the database closes under this header).
  const userId = useRouteLoaderData<typeof layoutLoader>("app")?.user.id ?? "";
  const query = useMemo(() => myGroupsQuery(userId), [userId]);
  const rows = useLiveQuery<GroupRow>(query.sql, query.params, NO_ROWS);
  const loaded = useRouteLoaderData<GroupContext>("group");
  const groups = useMemo(() => {
    if (rows !== NO_ROWS || loaded?.id !== groupId) return rows.map(toMyGroup);
    const { recipient } = loaded;
    return [
      {
        id: loaded.id,
        name: loaded.name,
        role: loaded.role,
        recipient: recipient && { id: recipient.id, displayName: recipient.displayName },
      } satisfies MyGroup,
    ];
  }, [rows, loaded, groupId]);
  const current = groups.find((g) => g.id === groupId);
  const timeZone = rows.find((row) => row.id === groupId)?.recipient_time_zone || null;
  const period = useCurrentCarePeriod(groupId, timeZone);

  // Only a group you're in is remembered (a stale link to another one isn't).
  const isMember = !!current;
  useEffect(() => {
    if (isMember && userId) rememberGroup(userId, groupId);
  }, [isMember, userId, groupId]);

  if (!current) return null;
  const name = displayName(current);
  const periodLabel = period ? periodName(period.span.period) : null;
  const PeriodIcon = period ? periodTypeMeta(period.span.period.type).icon : null;
  const destinations = [
    ...groups.filter((g) => g.id !== groupId).map((g) => appUrls.timeline(g.id)),
    appUrls.newGroup(),
    appUrls.profile(groupId),
    appUrls.periods(groupId),
    appUrls.groupSettings(groupId),
  ];
  const under = (path: string, to: string) => path === to || path.startsWith(`${to}/`);
  // A move within a destination (between settings subpages) is that page's own to show.
  const pending = !!pendingPath && destinations.some((to) => under(pendingPath, to) && !under(pathname, to));

  return (
    <Menu
      label={periodLabel ? `${name}, ${periodLabel}: switch care group` : `${name}: switch care group`}
      menuLabel="Care groups"
      variant="ghost"
      size="sm"
      className="min-w-0 gap-1 px-2 font-semibold"
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
        {
          id: "new-group",
          label: "New care group",
          icon: Plus,
          href: appUrls.newGroup(),
          state: NEW_GROUP_LINK_STATE,
        },
        SEPARATOR,
        ...(current.recipient
          ? [
              {
                id: "profile",
                label: `${current.recipient.displayName}'s profile`,
                icon: UserRound,
                href: appUrls.profile(groupId),
              },
            ]
          : []),
        {
          id: "care-periods",
          label: "Care periods",
          icon: MapPin,
          href: appUrls.periods(groupId),
        },
        {
          id: "group-settings",
          label: "Group settings",
          icon: Settings,
          href: appUrls.groupSettings(groupId),
        },
      ]}
    >
      <span className="truncate">{name}</span>
      {PeriodIcon && periodLabel && (
        // The button's label already names the period; this is the hover hint and the checks' hook.
        <span title={periodLabel} data-period-icon={period?.span.period.type} className="flex shrink-0">
          <PeriodIcon aria-hidden="true" className="size-4" />
        </span>
      )}
      {pending ? (
        <span aria-hidden="true" data-pending className="loading loading-spinner loading-xs shrink-0" />
      ) : (
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      )}
    </Menu>
  );
}
