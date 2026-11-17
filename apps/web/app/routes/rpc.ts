import type { Route } from "./+types/rpc";

import { createRpcHandler, getAuthConfig, getAuthUser, isError } from "~/.server/api";

// The oRPC API at /rpc/*. Web only; the native app calls the deployed web
// server's copy (Capacitor's origins are allowed cross-origin).
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

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
  return handle(request, authUser);
};

export const loader = ({ request }: Route.LoaderArgs) => serve(request);
export const action = ({ request }: Route.ActionArgs) => serve(request);
