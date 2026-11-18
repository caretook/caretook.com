import type { AuthUser } from "@caretook/data";

import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { router } from "./router";

export type RpcHandlerOptions = {
  /** Path the handler is mounted at, e.g. "/rpc". */
  prefix: `/${string}`;
  /** Cross-origin callers allowed with credentials (Capacitor's WebView, etc.). */
  allowedOrigins?: readonly string[];
};

/**
 * An HTTP handler for the router, independent of any framework. The caller
 * resolves the session and passes `authUser`; the handler never reads cookies.
 *
 * - CSRF: every call must carry `x-csrf-token: orpc` (the client link adds
 *   it). A cross-site form or <img> can't set custom headers, and setting
 *   one cross-origin needs a CORS preflight, which only `allowedOrigins` pass.
 * - GET is rejected unless a procedure opts in (oRPC's strict GET default).
 */
export const createRpcHandler = ({ prefix, allowedOrigins = [] }: RpcHandlerOptions) => {
  const handler = new RPCHandler(router, {
    plugins: [
      new CORSPlugin({
        origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
        credentials: true,
        allowHeaders: ["content-type", "authorization", "x-csrf-token"],
      }),
      new SimpleCsrfProtectionHandlerPlugin(),
    ],
  });

  return async (request: Request, authUser: AuthUser | null) => {
    const { matched, response } = await handler.handle(request, { prefix, context: { authUser } });
    return matched ? response : new Response("Not found", { status: 404 });
  };
};
