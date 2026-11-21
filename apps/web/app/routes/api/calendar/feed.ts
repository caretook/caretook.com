import type { Route } from "./+types/feed";

import { handleFeedRequest } from "~/.server/calendarFeed";

// A member's iCal feed (web only): `/api/calendar/<token>.ics`, read by
// calendar apps with no session: the secret token in the path is the
// credential (404 for any other), rate limited, `private` caching.
export const loader = ({ request, params }: Route.LoaderArgs) => handleFeedRequest(request, params.file);
