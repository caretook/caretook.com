import type { Route } from "./+types/rpc";

import { allowedOrigins, clientIpOf, createRpcHandler, getAuthUser } from "~/.server/api";

// The oRPC API at /rpc/*. Web only; the native app calls the deployed web
// server's copy, cross-origin, once NATIVE_APP_ORIGINS=1 lets it (host.ts in
// @caretook/auth: the origins and the client IP, shared with Better Auth).
// The session is looked up only by procedures that need the caller
// (B-140); a lookup error is a 500, logged with the procedure.

let handle: ReturnType<typeof createRpcHandler> | undefined;

const serve = (request: Request) => {
  handle ??= createRpcHandler({ prefix: "/rpc", allowedOrigins: allowedOrigins() });
  // The client IP is for the public forms' rate limit only (never stored).
  return handle(request, ({ live }) => getAuthUser(request.headers, { live }), {
    clientIp: clientIpOf(request.headers),
  });
};

export const loader = ({ request }: Route.LoaderArgs) => serve(request);
export const action = ({ request }: Route.ActionArgs) => serve(request);
