import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";
import type { ApiOutputs } from "~/lib/core/rpc";

import { CONNECTOR_READ_ONLY_BY_OWNER_LABEL } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { Link } from "react-router";
import { ConnectGuide } from "~/components/connectors";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { load } from "~/lib/core/api";
import { rpc } from "~/lib/core/rpc";
import { loadAssistantsSwitch, useAssistantsSetting } from "~/lib/care-groups/assistantsSwitch.sync";
import { failedSave } from "../api";
import { AssistantsSwitch } from "./AssistantsSwitch";
import {
  assistantsAccess,
  assistantsExplained,
  assistantsIntent,
  assistantsStatus,
  OFFLINE_ASSISTANTS,
} from "./assistants";
import { GroupConnections } from "./GroupConnections";
import { ReadOnlySwitch } from "./ReadOnlySwitch";
import { useConnectionsFollowReadOnly } from "./useConnectionsFollowReadOnly";

// `…/settings/assistants` (connectors slice 5). Shared by web + native.
// Whether members may connect their own AI assistant comes from the
// device's copy (`care_group.connectors_enabled`, live, so it shows offline
// and follows another owner's change). Owners turn it on or off, online,
// through `careGroup.update` (off disconnects everyone; on reconnects no
// one). Owners and admins see every member's connection to the group and
// disconnect any of them (`connector.listForGroup`, `connector.revoke`),
// online only. Everyone else sees the status and a link to their own
// connections on Settings → Devices. After the switch, for everyone, the
// connect guide (connectors-2 slice 1): the address and each client's steps,
// or the off note while the switch is off, with "Ask owners to turn this on"
// for everyone but owners (slice 2, `connector.requestEnable`). While
// assistants are on, owners choose read only (assistant-access) and everyone
// else sees it, from the same local row.

export const meta = () => [{ title: "Assistants · Group settings · Caretook" }];

export { shouldRevalidate } from "../api";

export type GroupConnection = ApiOutputs["connector"]["listForGroup"][number];

/** fetch fails with a TypeError when there's no connection. */
const offline = (e: unknown) => {
  if (e instanceof TypeError) return null;
  throw e;
};

export async function clientLoader({ request, params, context }: Route.ClientLoaderArgs) {
  const { groupId } = params;
  const group = getGroup(context);
  const { db } = context.get(sessionContext);
  const switchRows = await loadAssistantsSwitch(db, groupId);
  // Only owners and admins read the group's connections; the others' page is all local.
  const connections = assistantsAccess(group.role).manage
    ? await load(request, rpc.connector.listForGroup({ groupId })).catch(offline)
    : null;
  return { switchRows, connections, online: connections !== null };
}

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionResult> {
  const { groupId } = params;
  const intent = assistantsIntent(await request.formData());
  try {
    if (intent?.intent === "setEnabled") {
      await rpc.careGroup.update({ groupId, connectorsEnabled: intent.enabled });
      return { ok: true };
    }
    if (intent?.intent === "setReadOnly") {
      await rpc.careGroup.update({ groupId, connectorsReadOnly: intent.readOnly });
      return { ok: true };
    }
    if (intent?.intent === "disconnect") {
      await rpc.connector.revoke({ grantId: intent.id });
      return { ok: true };
    }
    return { ok: false, error: "Unknown action.", issues: [] };
  } catch (e) {
    // Already disconnected (by its member, another manager, or the switch): done.
    if (intent?.intent === "disconnect" && e instanceof ORPCError && e.code === "NOT_FOUND")
      return { ok: true };
    return failedSave(e);
  }
}

export default function GroupAssistants({ loaderData }: Route.ComponentProps) {
  const { switchRows, connections, online } = loaderData;
  const group = useGroup();
  const access = assistantsAccess(group.role);
  const { enabled, readOnly } = useAssistantsSetting(group.id, switchRows);
  useConnectionsFollowReadOnly(readOnly, !!switchRows[0]?.connectors_read_only, connections !== null);

  return (
    <SettingsPage
      title="Assistants"
      offlineNotice={access.manage && !online ? OFFLINE_ASSISTANTS : undefined}
    >
      <SettingsCard id="assistants-switch" title="AI assistants">
        <p className="text-muted text-sm">{assistantsExplained(enabled && readOnly)}</p>
        {access.toggle && online ? (
          <AssistantsSwitch enabled={enabled} connected={connections?.length ?? 0} />
        ) : (
          <p data-assistants-status="" className="text-sm">
            {assistantsStatus(enabled, access.toggle)}
          </p>
        )}
        {enabled && access.toggle && online && <ReadOnlySwitch readOnly={readOnly} />}
        {enabled && readOnly && !(access.toggle && online) && (
          <p data-assistants-read-only="" className="text-sm">
            {CONNECTOR_READ_ONLY_BY_OWNER_LABEL}
          </p>
        )}
        {!access.manage && (
          <p className="text-sm" data-devices-link="">
            Your own connected assistants are in{" "}
            <Link to={appUrls.settings("devices")} className="link link-primary">
              Settings → Devices
            </Link>
            .
          </p>
        )}
      </SettingsCard>
      <ConnectGuide
        place="group"
        groups={[{ role: group.role, enabled }]}
        canToggle={access.toggle}
        askGroupId={access.toggle ? undefined : group.id}
      />
      {access.manage && online && connections && <GroupConnections connections={connections} />}
    </SettingsPage>
  );
}
