// The web app's door to @caretook/notifications (server only; see data.ts
// for why .server/).
export * from "@caretook/notifications";

/** The dev mailbox exists only outside production. */
export const devMailEnabled = () => process.env.NODE_ENV !== "production";

/** Every /dev/mail route starts with this: a plain 404 in production. */
export const requireDevMail = () => {
  if (!devMailEnabled()) throw new Response("Not found", { status: 404 });
};
