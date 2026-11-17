import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";

/**
 * Browser auth client. On the web it uses same-origin cookies; pass
 * `baseURL` (the web server's origin) from the native app, which will also
 * need bearer-token storage when Capacitor lands.
 */
export const createCaretookAuthClient = (baseURL?: string) =>
  createAuthClient({ ...(baseURL ? { baseURL } : {}), plugins: [jwtClient()] });

export type CaretookAuthClient = ReturnType<typeof createCaretookAuthClient>;
