import { redirect } from "react-router";
import { authClient } from "~/lib/auth-client";
import { signInUrl } from "~/lib/redirect";

// Better Auth's session calls for the Devices page, as one shape: the data,
// "offline" when the request never reached the server, or a redirect to
// sign-in when this session has ended. Anything else throws.

type AuthResult<T> = { data: T | null; error: { status?: number; message?: string } | null };

export const OFFLINE = Symbol("offline");

export const authCall = async <T>(request: Request, call: () => Promise<AuthResult<T>>) => {
  let result: AuthResult<T>;
  try {
    result = await call();
  } catch (e) {
    // fetch fails with a TypeError when there's no connection.
    if (e instanceof TypeError) return OFFLINE;
    throw e;
  }
  const { data, error } = result;
  if (!error) return data;
  // An error without a status means the request never reached the server.
  if (!error.status) return OFFLINE;
  if (error.status === 401) throw redirect(signInUrl(request));
  throw new Error(`Devices: ${error.status}`);
};

export const listSessions = (request: Request) => authCall(request, () => authClient.listSessions());
export const currentSession = (request: Request) => authCall(request, () => authClient.getSession());
export const revokeSession = (request: Request, token: string) =>
  authCall(request, () => authClient.revokeSession({ token }));
export const revokeOtherSessions = (request: Request) =>
  authCall(request, () => authClient.revokeOtherSessions());
