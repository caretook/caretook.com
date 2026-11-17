import type { Router } from "@caretook/api";
import type { RouterClient } from "@orpc/server";

import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";

// The typed API client for /app routes (call it from clientLoader and
// clientAction). Types come from the router; no server code is bundled.
const link = new RPCLink({
  // A function, so it's read in the browser (same origin on the web).
  url: () => `${import.meta.env.VITE_API_ORIGIN || window.location.origin}/rpc`,
  // Sends the session cookie. The native app will add a bearer token here.
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  plugins: [new SimpleCsrfProtectionLinkPlugin()],
});

export const rpc: RouterClient<Router> = createORPCClient(link);
