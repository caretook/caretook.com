import type { Route } from "./+types/route";
import type { DeviceRow } from "./devices";

import { SettingsCard, SettingsPage } from "~/components/settings";
import { currentSession, listSessions, OFFLINE, revokeOtherSessions, revokeSession } from "./authCalls";
import { DeviceList } from "./DeviceList";
import { deviceRows, devicesIntent, OFFLINE_DEVICES, SIGN_OUT_FAILED } from "./devices";

// `/app/settings/devices` (quick-fixes slice 29, security review S-3): every
// browser signed in to this account, and signing one out, or every other one.
// Better Auth's own session calls, so online only. A device signed out here
// can't sign in to PowerSync again once its token (15 minutes) runs out, and
// goes to sign-in the next time it's online. Session tokens never reach the
// page: the action looks the token up by the session's id.

export const meta = () => [{ title: "Devices · Settings · Caretook" }];

export type DevicesActionResult = { ok: true } | { ok: false; error: string };

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const [sessions, current] = await Promise.all([listSessions(request), currentSession(request)]);
  if (sessions === OFFLINE || current === OFFLINE)
    return { online: false as const, devices: [] as DeviceRow[] };
  return { online: true as const, devices: deviceRows(sessions ?? [], current?.session.id ?? null) };
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<DevicesActionResult> {
  const intent = devicesIntent(await request.formData());
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

export default function DevicesSettings({ loaderData }: Route.ComponentProps) {
  const { online, devices } = loaderData;
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
    </SettingsPage>
  );
}
