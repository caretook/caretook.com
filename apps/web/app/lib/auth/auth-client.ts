import { createCaretookAuthClient } from "@caretook/auth/client";

// Same-origin on the web; the native app points at the deployed web server.
export const authClient = createCaretookAuthClient(import.meta.env.VITE_API_ORIGIN || undefined);
