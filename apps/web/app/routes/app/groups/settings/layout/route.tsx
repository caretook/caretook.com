import type { Route } from "./+types/route";

import { useMemo } from "react";
import { SettingsFrame } from "~/components/settings";
import { appUrls } from "~/lib/app-shell/appUrls";
import { groupSettingsPages } from "./settingsPages";

// `/app/groups/:groupId/settings`: the group's settings list beside (wide) or
// instead of (phones) the open subpage. Each subpage loads its own data; the
// group itself comes from the group route.

export default function GroupSettingsLayout({ params }: Route.ComponentProps) {
  const { groupId } = params;
  const items = useMemo(() => groupSettingsPages(groupId), [groupId]);
  return <SettingsFrame title="Group settings" listPath={appUrls.groupSettings(groupId)} items={items} />;
}
