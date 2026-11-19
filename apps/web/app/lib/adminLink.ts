import { isStaff } from "@caretook/data/schema";

// The account menu's Admin item (admin PRD): staff only (admin and support),
// from the session user's global role. On the web it's a path in this app;
// in the native build (which has no /admin) it's the web's /admin on
// `VITE_API_ORIGIN`, opened in the browser. Pure, tested.

export const ADMIN_PATH = "/admin";

export type AdminLink = { kind: "path"; href: string } | { kind: "external"; href: string };

/** Where Admin goes for a user with `role`, or null when they aren't staff. */
export const adminLink = (role: string | null | undefined, apiOrigin?: string | null): AdminLink | null => {
  if (!isStaff(role ? [role] : [])) return null;
  const origin = apiOrigin?.replace(/\/+$/, "");
  return origin ? { kind: "external", href: `${origin}${ADMIN_PATH}` } : { kind: "path", href: ADMIN_PATH };
};
