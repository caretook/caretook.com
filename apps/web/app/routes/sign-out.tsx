import { redirect } from "react-router";
import { authClient } from "~/lib/auth-client";
import { forgetGroups } from "~/lib/lastGroup";
import { forgetSettings } from "~/lib/me";
import { forgetSessionUser } from "~/lib/session";
import { closeSync } from "~/lib/sync";

// POST-only (a GET link could be triggered by any page). Shared by web + native.
export async function clientAction() {
  // Wipe the device's copy of the care data first: it may be a shared device.
  // Changes not uploaded yet are lost, which is the price of signing out offline.
  await closeSync().catch((e: unknown) => console.error("Couldn't clear local data", e));
  await authClient.signOut();
  forgetSessionUser();
  forgetSettings();
  forgetGroups();
  throw redirect("/sign-in");
}

export function clientLoader() {
  throw redirect("/app");
}

export default function SignOut() {
  return null;
}
