import type { Route } from "./+types/route";
import type { ApiOutputs } from "~/lib/core/rpc";
import type { DeviceRow } from "./devices";

import { ORPCError } from "@orpc/client";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { load } from "~/lib/core/api";
import { rpc } from "~/lib/core/rpc";
import { currentSession, listSessions, OFFLINE, revokeOtherSessions, revokeSession } from "./authCalls";
import { ConnectedAssistants } from "./ConnectedAssistants";
import { DeviceList } from "./DeviceList";
import {
  connectionIntent,
  deviceRows,
  devicesIntent,
  DISCONNECT_FAILED,
  OFFLINE_DEVICES,
  SIGN_OUT_FAILED,
} from "./devices";

// `/app/settings/devices` (quick-fixes slice 29, security review S-3): every
// browser signed in to this account, and signing one out, or every other one.
// Better Auth's own session calls, so online only. A device signed out here
// can't sign in to PowerSync again once its token (15 minutes) runs out, and
// goes to sign-in the next time it's online. Session tokens never reach the
// page: the action looks the token up by the session's id.
//
// After the sessions, the member's connected AI assistants (connectors
// slice 5): `connector.listMine` and `connector.revoke`, online too. Their
// tokens never reach the page either.

export const meta = () => [{ title: "Devices · Settings · Caretook" }];

export type DevicesActionResult = { ok: true } | { ok: false; error: string };

export type MyConnection = ApiOutputs["connector"]["listMine"][number];

/** The member's connected assistants; OFFLINE when the request never reached the server. */
const listConnections = (request: Request): Promise<MyConnection[] | typeof OFFLINE> =>
  load(request, rpc.connector.listMine()).catch((e: unknown) => {
    // fetch fails with a TypeError when there's no connection.
    if (e instanceof TypeError) return OFFLINE;
    throw e;
  });

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const [sessions, current, connections] = await Promise.all([
    listSessions(request),
    currentSession(request),
    listConnections(request),
  ]);
  if (sessions === OFFLINE || current === OFFLINE || connections === OFFLINE)
    return { online: false as const, devices: [] as DeviceRow[], connections: [] as MyConnection[] };
  return {
    online: true as const,
    devices: deviceRows(sessions ?? [], current?.session.id ?? null),
    connections,
  };
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<DevicesActionResult> {
  const form = await request.formData();
  const disconnect = connectionIntent(form);
  if (disconnect) return disconnectAssistant(disconnect.id);
  const intent = devicesIntent(form);
  if (!intent) return { ok: false, error: SIGN_OUT_FAILED };
  if (intent.intent === "signOutOthers") {
    const done = await revokeOtherSessions(request);
    return done === OFFLINE ? { ok: false, error: OFFLINE_DEVICES } : { ok: true };
  }
  const [sessions, current] = await Promise.all([listSessions(request), currentSession(request)]);
  if (sessions === OFFLINE || current === OFFLINE) return { ok: false, error: OFFLINE_DEVICES };
  // This device signs out through Sign out, never here; a session already gone is done.
  if (intent.id === current?.session.id) return { ok: false, error: SIGN_OUT_FAILED };
  const target = sessions?.find((s) => s.id === intent.id);
  if (!target) return { ok: true };
  const done = await revokeSession(request, target.token);
  return done === OFFLINE ? { ok: false, error: OFFLINE_DEVICES } : { ok: true };
}

/** Disconnect one of the member's assistants; one already gone is done. */
const disconnectAssistant = async (grantId: string): Promise<DevicesActionResult> => {
  try {
    await rpc.connector.revoke({ grantId });
    return { ok: true };
  } catch (e) {
    if (e instanceof TypeError) return { ok: false, error: OFFLINE_DEVICES };
    if (e instanceof ORPCError && e.code === "NOT_FOUND") return { ok: true };
    return { ok: false, error: DISCONNECT_FAILED };
  }
};

export default function DevicesSettings({ loaderData }: Route.ComponentProps) {
  const { online, devices, connections } = loaderData;
  return (
    <SettingsPage id="devices" title="Devices" offlineNotice={online ? undefined : OFFLINE_DEVICES}>
      {online && (
        <SettingsCard>
          <p className="text-base-content/70 text-sm">
            Where you&apos;re signed in. Sign out a device you no longer use, or one you&apos;ve lost.
          </p>
          <DeviceList devices={devices} />
        </SettingsCard>
      )}
      {online && <ConnectedAssistants connections={connections} />}
    </SettingsPage>
  );
}
