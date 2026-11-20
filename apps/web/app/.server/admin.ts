// The web app's door for /admin (server only; see data.ts for why .server/).
// Staff pages call the API in-process, as the signed-in staff member, so the
// API's staffProcedure is the one check that matters; this turns anyone
// else away first, and tells pages what the viewer may do.
import type { AuthUser, StaffCapability } from "@caretook/data";

import { router } from "@caretook/api";
import { getAuthUser } from "@caretook/auth";
import { isError, isStaff, logError, staffCan, staffCapabilities } from "@caretook/data";
import { getMailConfig, linkBuilder } from "@caretook/notifications";
import { createRouterClient } from "@orpc/server";
import QRCode from "qrcode";
import { redirect } from "react-router";
import { signInUrl } from "~/lib/redirect";

const apiFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });
export type AdminApi = ReturnType<typeof apiFor>;

/**
 * The signed-in staff member (admin or support), an API client acting as
 * them, and their capabilities (so pages render only what they may use).
 * Signed out → sign-in; anyone else, a group's owner included, gets a plain
 * 404, so the pages don't announce themselves. With `capability`, staff
 * without it get the same 404.
 */
export const requireStaff = async (request: Request, capability?: StaffCapability) => {
  const authUser = await getAuthUser(request.headers);
  if (isError(authUser)) {
    logError("admin: session lookup failed", authUser);
    throw new Response("Something went wrong", { status: 500 });
  }
  if (!authUser) throw redirect(signInUrl(request));
  if (!isStaff(authUser.roleNames) || (capability && !staffCan(authUser.roleNames, capability)))
    throw new Response("Not found", { status: 404 });
  return { authUser, api: apiFor(authUser), capabilities: staffCapabilities(authUser.roleNames) };
};

/** Where a code is used: `/join/<code>` on APP_URL, never the request's host. */
export const joinUrl = (code: string) =>
  linkBuilder(getMailConfig().appUrl)(`/join/${encodeURIComponent(code)}`);

/** A QR code for `text`, as an SVG document (scales to any print size). */
export const qrSvg = (text: string) =>
  QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
