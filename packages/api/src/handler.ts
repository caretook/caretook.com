import type { AuthUserLookup } from "./procedures";
import type { UserLimits } from "./rateLimit";

import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, ResponseHeadersPlugin, SimpleCsrfProtectionHandlerPlugin } from "@orpc/server/plugins";
import { lazyAuthUser } from "./procedures";
import { router } from "./router";

export type RpcHandlerOptions = {
  /** Path the handler is mounted at, e.g. "/rpc". */
  prefix: `/${string}`;
  /** Cross-origin callers allowed with credentials (Capacitor's WebView, etc.). */
  allowedOrigins?: readonly string[];
  /** The per-user limits, for a test (otherwise the process's, procedures.ts). */
  userLimits?: UserLimits;
};

/**
 * An HTTP handler for the router, independent of any framework. The caller
 * passes its session lookup, which runs only when a procedure needs the
 * caller (B-140: public procedures never look up a session), at most once
 * per mode per request; the handler never reads cookies.
 *
 * - CSRF: every call must carry `x-csrf-token: orpc` (the client link adds
 *   it). A cross-site form or <img> can't set custom headers, and setting
 *   one cross-origin needs a CORS preflight, which only `allowedOrigins` pass.
 * - GET is rejected unless a procedure opts in (oRPC's strict GET default).
 * - Signed-in procedures are limited per user (procedures.ts): a 429 with
 *   `retry-after`.
 */
export const createRpcHandler = ({ prefix, allowedOrigins = [], userLimits }: RpcHandlerOptions) => {
  const handler = new RPCHandler(router, {
    plugins: [
      new CORSPlugin({
        origin: (origin) => (allowedOrigins.includes(origin) ? origin : null),
        credentials: true,
        allowHeaders: ["content-type", "authorization", "x-csrf-token"],
      }),
      new SimpleCsrfProtectionHandlerPlugin(),
      // A 429's `retry-after` (procedures.ts's per-user limits).
      new ResponseHeadersPlugin(),
    ],
  });

  /** `clientIp` is the caller's address as the mount point trusts it (only for rate limits; never stored). */
  return async (
    request: Request,
    lookup: AuthUserLookup,
    { clientIp }: { clientIp?: string | null } = {},
  ) => {
    const { matched, response } = await handler.handle(request, {
      prefix,
      context: { getAuthUser: lazyAuthUser(lookup), clientIp, ...(userLimits ? { userLimits } : {}) },
    });
    return matched ? response : new Response("Not found", { status: 404 });
  };
};
