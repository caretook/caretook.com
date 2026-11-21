// @caretook/notifications: server only. Email through a typed registry and a
// transactional outbox. In apps/web, import it through app/.server/notifications.ts.
//
//   const queued = await notify("testMessage", {
//     to, data: { name, message }, idempotencyKey: `test:${id}`, tx,
//   });
//   // after the transaction commits:
//   if (!isError(queued)) deliverSoon(queued.id);
export * from "./config";
export * from "./calendarCron";
export * from "./cron";
export * from "./define";
export * from "./devMail";
export * from "./links";
export * from "./outbox";
export * from "./registry";
export * from "./reminders";
export * from "./render";
export * from "./senders";
export * from "./resendWebhook";
export * from "./webhookSignature";
