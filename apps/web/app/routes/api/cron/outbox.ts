import type { Route } from "./+types/outbox";

import { handleOutboxCron } from "~/.server/notifications";

// The outbox sweep (web only): deliver due email, retry failures with
// backoff, purge old sent rows. Vercel Cron calls it with GET and
// `Authorization: Bearer $CRON_SECRET`; POST works too.
export const loader = ({ request }: Route.LoaderArgs) => handleOutboxCron(request);
export const action = ({ request }: Route.ActionArgs) => handleOutboxCron(request);
