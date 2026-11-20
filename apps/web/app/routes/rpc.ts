import type { Route } from "./+types/rpc";

import { allowedOrigins, clientIpOf, createRpcHandler, getAuthUser, isError, logError } from "~/.server/api";

// The oRPC API at /rpc/*. Web only; the native app calls the deployed web
// server's copy, cross-origin, once NATIVE_APP_ORIGINS=1 lets it (host.ts in
// @caretook/auth: the origins and the client IP, shared with Better Auth).

/** The procedure a request names (`careGroup.create`), if its path is plain. */
const procedureOf = (url: string) => {
  const path = new URL(url).pathname.replace(/^\/rpc\//, "");
  return /^[\w/]{1,100}$/.test(path) ? path.replaceAll("/", ".") : undefined;
};

let handle: ReturnType<typeof createRpcHandler> | undefined;

const serve = async (request: Request) => {
  handle ??= createRpcHandler({ prefix: "/rpc", allowedOrigins: allowedOrigins() });
  const authUser = await getAuthUser(request.headers);
  if (isError(authUser)) {
    logError("rpc: session lookup failed", authUser, { procedure: procedureOf(request.url) });
    return new Response("Something went wrong", { status: 500 });
  }
  // For the public forms' rate limit only (never stored).
  return handle(request, authUser, { clientIp: clientIpOf(request.headers) });
};

export const loader = ({ request }: Route.LoaderArgs) => serve(request);
export const action = ({ request }: Route.ActionArgs) => serve(request);
