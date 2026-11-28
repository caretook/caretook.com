import type { Route } from "./+types/sign-out";

import { redirect } from "react-router";
import { appUrls } from "~/lib/app-shell/appUrls";
import { formString } from "~/lib/core/form";
import { safeRedirect } from "~/lib/core/redirect";
import { confirmedSessionId, signOutOnServer } from "~/lib/auth/pendingSignOut";
import { wipeDevice } from "~/lib/auth/session";

// POST-only (a GET link could be triggered by any page). Shared by web + native.
// An optional `redirectTo` (a same-site path) is where to go next, e.g. back to
// an invite that's for another account; by default, sign-in.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData().catch(() => new FormData());
  const next = safeRedirect(formString(form, "redirectTo"), "/sign-in");
  // Wipe the device's copy of the care data first: it may be a shared device.
  // Changes not uploaded yet are lost: the account menu asks first when any wait (B-290).
  // The session's id is read first: the wipe forgets it.
  const sessionId = confirmedSessionId();
  await wipeDevice();
  // Offline, the server's half is left pending (for this session) and
  // finished the next time the app reaches it, before any session check
  // (lib/auth/pendingSignOut).
  await signOutOnServer(sessionId);
  throw redirect(next);
}

export function clientLoader() {
  throw redirect(appUrls.home());
}

export default function SignOut() {
  return null;
}
