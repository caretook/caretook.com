import { createAuthClient } from "better-auth/client";
import { emailOTPClient, jwtClient, magicLinkClient } from "better-auth/client/plugins";

/**
 * Browser auth client. On the web it uses same-origin cookies; pass
 * `baseURL` (the web server's origin) from the native app, which will also
 * need bearer-token storage when Capacitor lands.
 */
export const createCaretookAuthClient = (baseURL?: string) =>
  createAuthClient({
    ...(baseURL ? { baseURL } : {}),
    // The global fetch at each request, not at creation (Better Auth's
    // default), so a component test's stubbed network reaches it too.
    fetchOptions: { customFetchImpl: (input, init) => fetch(input, init) },
    plugins: [jwtClient(), magicLinkClient(), emailOTPClient()],
  });

export type CaretookAuthClient = ReturnType<typeof createCaretookAuthClient>;
