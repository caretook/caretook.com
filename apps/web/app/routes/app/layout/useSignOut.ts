import { useState } from "react";
import { useSubmit } from "react-router";
import { localCopyFate } from "~/lib/auth/localCopyRules";
import { useSyncState } from "~/lib/sync";

/** The sign-out dialog's words for `waiting` changes still on this device. */
export const signOutWarning = (waiting: number) =>
  waiting === 1
    ? { title: "1 change hasn't reached the server", message: "Sign out and lose it?" }
    : { title: `${waiting} changes haven't reached the server`, message: "Sign out and lose them?" };

/**
 * The account menu's Sign out (B-290): a POST to `/sign-out` at once, or,
 * with changes waiting to upload (`localCopyFate` says ask), a dialog first:
 * signing out wipes them with the rest of the device's copy.
 */
export function useSignOut() {
  const submit = useSubmit();
  const waiting = useSyncState()?.waiting ?? 0;
  const [asking, setAsking] = useState(false);
  // POST, as the old header form did (a GET link could be triggered by any page).
  const signOut = () => void submit(null, { method: "post", action: "/sign-out" });
  return {
    waiting,
    asking,
    start: () => (localCopyFate({ reason: "signOut", waiting }) === "ask" ? setAsking(true) : signOut()),
    confirm: () => {
      setAsking(false);
      signOut();
    },
    cancel: () => setAsking(false),
  };
}
