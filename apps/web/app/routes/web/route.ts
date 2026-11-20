import type { Route } from "./+types/route";

import { applySecurityHeaders } from "~/.server/securityHeaders";

// A pathless layout around every web-only route (routes.ts), only for this
// middleware: resource routes (/rpc, /api/auth, sitemap.xml, exports, the dev
// mailbox's JSON…) never pass through entry.server.tsx, so their security
// headers are added here (quick-fixes slice 22). Documents already have theirs,
// with the nonce, and keep them (applySecurityHeaders keeps what's set).
// Native has no web-only routes, so this module isn't in its build (root.tsx
// can't take a server middleware: SPA mode refuses one).
export const middleware: Route.MiddlewareFunction[] = [
  async (_args, next) => {
    const response = await next();
    try {
      applySecurityHeaders(response.headers);
      return response;
    } catch {
      // Immutable headers (a Response passed through from fetch): copy it.
      const copy = new Response(response.body, response);
      applySecurityHeaders(copy.headers);
      return copy;
    }
  },
];
