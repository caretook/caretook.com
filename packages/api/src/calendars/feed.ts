import type { RateLimiter } from "../rateLimit";

import { clientIpKey } from "@caretook/auth";
import { calendarFeedService, isError, logError } from "@caretook/data";
import { createRateLimiter, defaultStore } from "../rateLimit";
import { renderIcs } from "./renderIcs";

// `GET /api/calendar/<token>.ics` (appointments-2, slice 5; web only): a
// member's calendar feed, subscribed to by Apple, Google or Outlook. The
// token in the path is the only credential, so:
//   - an unknown or revoked token, a former member's, or a path that isn't
//     `<token>.ics` is a bodyless 404 (nothing says which);
//   - hits are limited per client IP (`clientIpKey`) and per token, then 429
//     with Retry-After; in production no client IP is a 400 (logged);
//   - the token is never logged (logs carry the procedure and the code only)
//     and the responses are `private`: a shared cache must not hold them.

/** Requests a client IP, and a token, may make in a minute (calendar apps poll hourly or so). */
export const FEED_RATE_LIMIT = { perIp: 60, perToken: 30 } as const;
const MINUTE_MS = 60_000;

/** How long a client may reuse a feed (seconds). */
export const FEED_MAX_AGE = 300;

export type FeedHandlerOptions = {
  /** The app's origin (`APP_URL`), for links and UIDs. */
  appUrl: () => string;
  ipLimiter?: RateLimiter;
  tokenLimiter?: RateLimiter;
  now?: () => Date;
};

const notFound = () => new Response(null, { status: 404 });

const EXTENSION = ".ics";

export const createFeedHandler = ({
  appUrl,
  ipLimiter = createRateLimiter({
    limit: FEED_RATE_LIMIT.perIp,
    windowMs: MINUTE_MS,
    store: defaultStore("calendar-feed-ip"),
  }),
  tokenLimiter = createRateLimiter({
    limit: FEED_RATE_LIMIT.perToken,
    windowMs: MINUTE_MS,
    store: defaultStore("calendar-feed-token"),
  }),
  now = () => new Date(),
}: FeedHandlerOptions) => {
  const tooMany = () => new Response(null, { status: 429, headers: { "retry-after": "60" } });

  /** `file` is the path's last part: `<token>.ics`. */
  return async (
    request: Request,
    { file, clientIp }: { file: string; clientIp?: string | null },
  ): Promise<Response> => {
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    if (!file.endsWith(EXTENSION)) return notFound();
    const token = file.slice(0, -EXTENSION.length);

    const ipKey = clientIpKey(clientIp, "calendar.feed");
    if (ipKey === null) return new Response(null, { status: 400 });
    if (!(await ipLimiter.hit(ipKey))) return tooMany();
    // The hash, not the token, names the key (the postgres store keeps keys).
    if (!(await tokenLimiter.hit(calendarFeedService.fingerprint(token)))) return tooMany();

    const feed = await calendarFeedService.load(token, { now: now(), appUrl: appUrl() });
    if (isError(feed)) {
      logError("calendar feed: load failed", feed, { procedure: "calendar.feed" });
      return new Response(null, { status: 500 });
    }
    if (!feed) return notFound();

    const body = renderIcs(feed.items, feed.level, {
      calendarName: feed.calendarName,
      appUrl: appUrl(),
      now: now(),
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "cache-control": `private, max-age=${FEED_MAX_AGE}`,
        "content-disposition": 'inline; filename="caretook.ics"',
      },
    });
  };
};

/** A feed's URL for `token`, on the app's origin. */
export const feedUrl = (appUrl: string, token: string) =>
  `${appUrl.replace(/\/+$/, "")}/api/calendar/${token}${EXTENSION}`;
