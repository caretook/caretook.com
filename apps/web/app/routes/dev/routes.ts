import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Notifications (web only): the outbox sweep (CRON_SECRET), Resend's bounce and
// complaint webhook (Svix-signed; hosting PRD), the calendar feed (a secret token
// in the path) and the dev mailbox (404 in production).
export const notificationRoutes: RouteConfigEntry[] = [
  route("api/cron/outbox", "routes/api/cron/outbox.ts"),
  route("api/cron/calendar", "routes/api/cron/calendar.ts"),
  route("api/calendar/:file", "routes/api/calendar/feed.ts"),
  route("dev/mail", "routes/dev/mail/list/route.tsx"),
  route("dev/mail.json", "routes/dev/mail/json/route.ts"),
  route("dev/mail/:id", "routes/dev/mail/message/route.tsx"),
  route("api/webhooks/resend", "routes/api/webhooks/resend.ts"),
  // A reminder email's one-click unsubscribe (calendars, appointments-2).
  route("api/reminders/unsubscribe/:token", "routes/api/reminders/unsubscribe.ts"),
];

// The UI gallery (components, ui-kit PRD; web only, 404 in production): every
// ui/ primitive in light and dark. Its gate is `~/.server/devUi`.
export const devUiRoutes: RouteConfigEntry[] = [route("dev/ui", "routes/dev/ui/route.tsx")];
