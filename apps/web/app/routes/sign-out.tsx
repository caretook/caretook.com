import type { Route } from "./+types/sign-out";

import { redirect } from "react-router";
import { appUrls } from "~/lib/appUrls";
import { authClient } from "~/lib/auth-client";
import { formString } from "~/lib/form";
import { safeRedirect } from "~/lib/redirect";
import { wipeDevice } from "~/lib/session";

// POST-only (a GET link could be triggered by any page). Shared by web + native.
// An optional `redirectTo` (a same-site path) is where to go next, e.g. back to
// an invite that's for another account; by default, sign-in.
export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData().catch(() => new FormData());
  const next = safeRedirect(formString(form, "redirectTo"), "/sign-in");
  // Wipe the device's copy of the care data first: it may be a shared device.
  // Changes not uploaded yet are lost, which is the price of signing out offline.
  await wipeDevice();
  await authClient.signOut();
  throw redirect(next);
}

export function clientLoader() {
  throw redirect(appUrls.home());
}

export default function SignOut() {
  return null;
}
