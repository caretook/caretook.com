import type { AppError, AuthUser, GoogleCalendarClient } from "@caretook/data";

import { googleConnectionService, isError, logError } from "@caretook/data";
import { z } from "zod";

// Connecting Google Calendar (appointments-2, slice 7): the web-only
// `/api/google/connect` (a plain link from the Google card: it sends the
// member on to Google's consent page) and `/api/google/callback` (where
// Google sends them back). Both end on a redirect: to Google, or back to
// the group's Calendar & reminders page with `?google=<outcome>`. A GET
// navigation, not a form post, so `form-action 'self'` doesn't block the
// redirect to Google. The state is the member's own, single use, for 10
// minutes; a bad or expired one is refused.

/** What the settings page is told, in `?google=`. */
export const GOOGLE_OUTCOMES = ["connected", "expired", "denied", "unavailable", "failed"] as const;
export type GoogleOutcome = (typeof GOOGLE_OUTCOMES)[number];

type Deps = {
  getAuthUser: (headers: Headers) => Promise<AuthUser | null | AppError>;
  client?: GoogleCalendarClient | null;
  now?: Date;
};

const groupIdZ = z.uuid();
const settingsPath = (groupId: string) => `/app/groups/${groupId}/settings/calendar`;

const redirectTo = (location: string) =>
  new Response(null, { status: 302, headers: { location, "cache-control": "no-store" } });

const back = (groupId: string | null, outcome: GoogleOutcome) =>
  redirectTo(groupId ? `${settingsPath(groupId)}?google=${outcome}` : `/app?google=${outcome}`);

const signIn = (path: string) => redirectTo(`/sign-in?redirectTo=${encodeURIComponent(path)}`);

const actor = async (request: Request, deps: Deps) => {
  const authUser = await deps.getAuthUser(request.headers);
  if (isError(authUser)) {
    logError("calendars: Google connect couldn't read the session", authUser);
    return null;
  }
  return authUser;
};

/** `GET /api/google/connect?groupId=…`: on to Google's consent page, for a member of the group. */
export const handleGoogleConnect = async (request: Request, deps: Deps) => {
  const parsed = groupIdZ.safeParse(new URL(request.url).searchParams.get("groupId"));
  if (!parsed.success) return new Response(null, { status: 404 });
  const groupId = parsed.data;
  const authUser = await actor(request, deps);
  if (!authUser) return signIn(settingsPath(groupId));
  const started = await googleConnectionService.start({ authUser }, groupId, {
    ...(deps.client !== undefined && { client: deps.client }),
    now: deps.now,
  });
  if (isError(started)) {
    if (started.code === "googleConnectionService:notMember") return new Response(null, { status: 404 });
    if (started.code !== "googleConnectionService:notConfigured")
      logError("calendars: Google connect failed", started, { groupId });
    return back(groupId, "unavailable");
  }
  return redirectTo(started.url);
};

/** `GET /api/google/callback?code=…&state=…` (or `?error=…`): finish connecting, then back to the page. */
export const handleGoogleCallback = async (request: Request, deps: Deps) => {
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  // Read before `complete` uses the state up: where to send the member back.
  const groupId = state ? await googleConnectionService.stateGroup(state) : null;
  if (params.get("error")) return back(groupId, "denied");
  if (!state || !code) return back(groupId, "expired");
  const authUser = await actor(request, deps);
  if (!authUser) return back(groupId, "expired");
  const done = await googleConnectionService.complete(
    { authUser },
    { code, state },
    {
      ...(deps.client !== undefined && { client: deps.client }),
      now: deps.now,
    },
  );
  if (!isError(done)) return back(done.groupId, "connected");
  if (done.code === "googleConnectionService:badState" || done.code === "googleConnectionService:notMember")
    return back(groupId, "expired");
  logError("calendars: Google callback failed", done, { groupId: groupId ?? undefined });
  return back(groupId, done.code === "googleConnectionService:notConfigured" ? "unavailable" : "failed");
};
