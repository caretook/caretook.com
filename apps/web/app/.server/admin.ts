// The web app's door for /admin (server only; see data.ts for why .server/).
// Staff pages call the API in-process, as the signed-in staff member, so the
// API's adminProcedure is the one check that matters; this turns anyone
// else away first.
import type { AuthUser } from "@caretook/data";

import { router } from "@caretook/api";
import { getAuthUser } from "@caretook/auth";
import { isError, logError } from "@caretook/data";
import { getMailConfig, linkBuilder } from "@caretook/notifications";
import { createRouterClient } from "@orpc/server";
import QRCode from "qrcode";
import { redirect } from "react-router";
import { signInUrl } from "~/lib/redirect";

const apiFor = (authUser: AuthUser) => createRouterClient(router, { context: { authUser } });
export type AdminApi = ReturnType<typeof apiFor>;

/**
 * The signed-in staff member (global `admin`) and an API client acting as
 * them. Signed out → sign-in; anyone else, a group's owner included, gets a
 * plain 404, so the pages don't announce themselves.
 */
export const requireStaff = async (request: Request) => {
  const authUser = await getAuthUser(request.headers);
  if (isError(authUser)) {
    logError("admin: session lookup failed", authUser);
    throw new Response("Something went wrong", { status: 500 });
  }
  if (!authUser) throw redirect(signInUrl(request));
  if (!authUser.roleNames.includes("admin")) throw new Response("Not found", { status: 404 });
  return { authUser, api: apiFor(authUser) };
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
