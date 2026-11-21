// The web app's door for the calendar feed (server only; see data.ts for why
// .server/): `GET /api/calendar/<token>.ics`. The work is in @caretook/api's
// calendars module; the token is the only credential and is never logged.
import { createFeedHandler } from "@caretook/api";
import { getMailConfig } from "@caretook/notifications";
import { clientIpOf } from "./api";

let feed: ReturnType<typeof createFeedHandler> | undefined;

export const handleFeedRequest = (request: Request, file: string) => {
  feed ??= createFeedHandler({ appUrl: () => getMailConfig().appUrl });
  return feed(request, { file, clientIp: clientIpOf(request.headers) });
};
