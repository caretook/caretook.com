import type { GroupContext } from "~/lib/groupContext";
import type { MyGroup } from "~/lib/rpc";
import type { clientLoader as layoutLoader } from "./route";
import type { GroupRow } from "~/lib/sync/timeline";

import { ChevronDown, History, Plus, Settings, UserRound } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { Menu, SEPARATOR } from "~/components/ui";
import { appUrls } from "~/lib/appUrls";
import { rememberGroup } from "~/lib/lastGroup";
import { useLiveQuery } from "~/lib/sync";
import { myGroupsQuery, toMyGroup } from "~/lib/sync/timeline";
import { NEW_GROUP_LINK_STATE } from "~/lib/newGroupLink";
import { menuNowText, periodName, periodTypeMeta } from "~/lib/periodDisplay";
import { useCurrentCarePeriod } from "~/lib/sync/currentPeriod";

/** What a group is called in the header: its recipient (preferred name first), then the group's name. */
const displayName = (group: MyGroup) => group.recipient?.displayName || group.name;

// One array for every render: `useLiveQuery` treats a new `initial` as new loader data.
const NO_ROWS: GroupRow[] = [];

/**
 * The header's `group` region on `/app/groups/:groupId/*`: the current
 * group's display name as a menu listing every group on this device (live,
 * so it works offline), the current one checked. Choosing one opens its
 * timeline; "<Name>'s profile" opens the recipient's profile, "Group settings"
 * the current group's settings, and "New
 * care group" the New care group sheet (closing it comes back). Loading a
 * group route also remembers it for `/app`.
 *
 * With a care period, the button shows the current period's type icon after
 * the name (the period's name as its text and hover hint), and the menu opens
 * with "Now: In hospital · day 4", linking to the period; "Care periods"
 * opens the group's periods page.
 *
 * Until the device's list answers (a moment after the page renders), the
 * group route's own copy of the current group stands in, so the header never
 * shows without its group menu.
 */
export function GroupMenu({ groupId }: { groupId: string }) {
  const navigate = useNavigate();
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

  return (
    <Menu
      label={periodLabel ? `${name}, ${periodLabel}: switch care group` : `${name}: switch care group`}
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
        ...(period && PeriodIcon
          ? [
              {
                id: "period-now",
                label: menuNowText(period.span.period, period.day),
                icon: PeriodIcon,
                href: appUrls.period(groupId, period.span.period.id),
              },
            ]
          : []),
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
          id: "group-settings",
          label: "Group settings",
          icon: Settings,
          href: appUrls.groupSettings(groupId),
        },
        {
          id: "care-periods",
          label: "Care periods",
          icon: History,
          href: appUrls.periods(groupId),
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
      {PeriodIcon && periodLabel && (
        // The button's label already names the period; this is the hover hint and the checks' hook.
        <span title={periodLabel} data-period-icon={period?.span.period.type} className="flex shrink-0">
          <PeriodIcon aria-hidden="true" className="size-4" />
        </span>
      )}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
    </Menu>
  );
}
