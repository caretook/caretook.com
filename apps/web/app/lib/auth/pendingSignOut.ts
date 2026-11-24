import { authClient } from "./auth-client";

// A sign-out the server hasn't heard about yet (sync-safety slice 4, B-290).
// Sign out wipes the device first and then tells the server; offline that
// second step fails, so a marker is left and the app finishes it the next
// time it reaches the server, before any session check (`requireSession`,
// and the sign-in page's loader and action): until then the session cookie
// could still open the app. Light: the sign-in page imports it.

const PENDING_KEY = "caretook:sign-out-pending";

/** Whether a sign-out is still owed to the server. */
export const signOutPending = (): boolean => {
  try {
    return localStorage.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
};

const setPending = (pending: boolean) => {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, String(Date.now()));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: nothing to finish later.
  }
};

/**
 * Ask the server to end this device's session. True once the server has
 * answered with anything but a server error (a 4xx means there's no session
 * left to end); false offline or on a 5xx.
 */
const tellServer = async (): Promise<boolean> => {
  try {
    const { error } = await authClient.signOut();
    return !error || (typeof error.status === "number" && error.status >= 400 && error.status < 500);
  } catch {
    // fetch's TypeError: no connection.
    return false;
  }
};

/** Sign-out's server half: tell the server, or leave the marker to finish it later. */
export const signOutOnServer = async (): Promise<void> => {
  setPending(!(await tellServer()));
};

/**
 * Finish a pending sign-out, if there is one. Resolves true while it's still
 * pending (the server couldn't be reached): the caller treats the device as
 * signed out without asking the server who is signed in. The marker is
 * cleared only once the server has the sign-out.
 */
export const finishPendingSignOut = async (): Promise<boolean> => {
  if (!signOutPending()) return false;
  if (!(await tellServer())) return true;
  setPending(false);
  return false;
};
