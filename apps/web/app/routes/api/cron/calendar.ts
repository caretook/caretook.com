import type { Route } from "./+types/calendar";

import { handleCalendarCron } from "~/.server/notifications";

// The calendar cron (web only): series top-up now; reminders and Google sync
// add steps. Vercel Cron calls it with GET and `Authorization: Bearer $CRON_SECRET`.
export const loader = ({ request }: Route.LoaderArgs) => handleCalendarCron(request);
export const action = ({ request }: Route.ActionArgs) => handleCalendarCron(request);
