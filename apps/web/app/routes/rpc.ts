import type { Route } from "./+types/rpc";

import { createRpcHandler, getAuthConfig, getAuthUser, isError } from "~/.server/api";

// The oRPC API at /rpc/*. Web only; the native app calls the deployed web
// server's copy (Capacitor's origins are allowed cross-origin).
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

/**
 * The caller's address, for the public forms' rate limit only (never
 * stored): the first `x-forwarded-for` entry, which the host (Vercel) sets,
 * else `x-real-ip`.
 */
const clientIpOf = (headers: Headers) =>
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || null;

let handle: ReturnType<typeof createRpcHandler> | undefined;

const serve = async (request: Request) => {
  handle ??= createRpcHandler({
    prefix: "/rpc",
    allowedOrigins: [...NATIVE_ORIGINS, ...getAuthConfig().trustedOrigins],
  });
  const authUser = await getAuthUser(request.headers);
  if (isError(authUser)) {
    console.error(authUser);
    return new Response("Something went wrong", { status: 500 });
  }
  return handle(request, authUser, { clientIp: clientIpOf(request.headers) });
};

export const loader = ({ request }: Route.LoaderArgs) => serve(request);
export const action = ({ request }: Route.ActionArgs) => serve(request);
