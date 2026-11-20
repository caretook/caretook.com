// React Router's default Node entry, plus the security headers (quick-fixes
// slice 22): every document gets a fresh nonce, used by React Router's and
// React's inline scripts and named in its Content-Security-Policy. `.data`
// responses get the same headers here; web-only resource routes get them from
// the `web` layout route's middleware (routes/web/route.ts). All of it comes
// from .server/securityHeaders.ts.
//
// Hosting slice 1: with APP_ENV set, every request first passes the deploy
// env check (.server/deployEnv.ts), answering 503 until it's fixed; and on
// Vercel, background email runs under `waitUntil`.
import { PassThrough } from "node:stream";

import type { EntryContext, HandleDataRequestFunction, RouterContextProvider } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import type { RenderToPipeableStreamOptions } from "react-dom/server";
import { renderToPipeableStream } from "react-dom/server";
import { waitUntil } from "@vercel/functions";

import { deployEnvRefusal } from "./.server/deployEnv";
import { setBackgroundRunner } from "./.server/notifications";
import { applySecurityHeaders, contentSecurityPolicy, envOptions, newNonce } from "./.server/securityHeaders";
import { CspContext } from "./lib/security-headers/csp";

export const streamTimeout = 5_000;

// Once, at server start. Vercel freezes a function when its response is sent:
// `waitUntil` keeps a background send (sign-in email) alive until it's done.
// Elsewhere (dev, check builds, Node) the default fire-and-forget runner stays.
if (process.env.VERCEL) setBackgroundRunner((work) => waitUntil(work));

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  // Not while the native SPA's shell is prerendered at build: that's no deploy.
  const refusal = routerContext.isSpaMode ? null : deployEnvRefusal(request);
  if (refusal) {
    applySecurityHeaders(refusal.headers);
    return refusal;
  }

  const options = envOptions();
  const nonce = newNonce();
  responseHeaders.delete("Content-Security-Policy");
  applySecurityHeaders(responseHeaders, { ...options, nonce });
  // The same policy as a <meta>, first in <head>: a prerendered page or the
  // native SPA is served as a file, without this response's headers.
  const csp = { nonce, policy: contentSecurityPolicy({ ...options, nonce, meta: true }) };

  // https://httpwg.org/specs/rfc9110.html#HEAD
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("user-agent");

    // Bots and SPA Mode renders wait for all content to load before responding.
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";

    // Abort the rendering stream after `streamTimeout`, leaving time to flush rejected boundaries.
    let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
      () => abort(),
      streamTimeout + 1000,
    );

    const { pipe, abort } = renderToPipeableStream(
      <CspContext value={csp}>
        <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
      </CspContext>,
      {
        nonce,
        [readyOption]() {
          shellRendered = true;
          const body = new PassThrough({
            final(callback) {
              clearTimeout(timeoutId);
              timeoutId = undefined;
              callback();
            },
          });
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          pipe(body);

          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));
        },
        onShellError(error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Errors in the shell reject and are logged by handleDocumentRequest.
          if (shellRendered) console.error(error);
        },
      },
    );
  });
}

export const handleDataRequest: HandleDataRequestFunction = (response, { request }) => {
  const refusal = deployEnvRefusal(request);
  if (refusal) {
    applySecurityHeaders(refusal.headers);
    return refusal;
  }
  applySecurityHeaders(response.headers);
  return response;
};
