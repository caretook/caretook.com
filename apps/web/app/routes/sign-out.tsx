import { redirect } from "react-router";
import { authClient } from "~/lib/auth-client";

// POST-only (a GET link could be triggered by any page). Shared by web + native.
export async function clientAction() {
  await authClient.signOut();
  throw redirect("/sign-in");
}

export function clientLoader() {
  throw redirect("/app");
}

export default function SignOut() {
  return null;
}
