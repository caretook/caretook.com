import { type RouteConfigEntry, route } from "@react-router/dev/routes";

// Notifications (web only): the outbox sweep (CRON_SECRET), Resend's bounce and
// complaint webhook (Svix-signed; hosting PRD) and the dev mailbox (404 in production).
export const notificationRoutes: RouteConfigEntry[] = [
  route("api/cron/outbox", "routes/api/cron/outbox.ts"),
  route("api/cron/calendar", "routes/api/cron/calendar.ts"),
  route("dev/mail", "routes/dev/mail/list/route.tsx"),
  route("dev/mail.json", "routes/dev/mail/json/route.ts"),
  route("dev/mail/:id", "routes/dev/mail/message/route.tsx"),
  route("api/webhooks/resend", "routes/api/webhooks/resend.ts"),
  // A reminder email's one-click unsubscribe (calendars, appointments-2).
  route("api/reminders/unsubscribe/:token", "routes/api/reminders/unsubscribe.ts"),
];
