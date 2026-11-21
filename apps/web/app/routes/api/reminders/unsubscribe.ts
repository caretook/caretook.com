import type { Route } from "./+types/unsubscribe";

import { handleReminderUnsubscribe } from "~/.server/notifications";

// A reminder email's unsubscribe link (web only; calendars, appointments-2
// slice 6). GET asks with one button; POST (that button, or a mail app's
// one-click `List-Unsubscribe-Post`) turns the member's reminders off in
// that group. The signed token is the proof: no sign-in, no CSRF check.
export const loader = ({ request, params }: Route.LoaderArgs) =>
  handleReminderUnsubscribe(request, params.token);
export const action = ({ request, params }: Route.ActionArgs) =>
  handleReminderUnsubscribe(request, params.token);
