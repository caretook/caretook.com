import type { Sender } from "./types";

import { SYSTEM_USER, devMailSchema, getDb } from "@caretook/data";

/**
 * Development: "send" by storing the message in `dev_mail`, where `/dev/mail`
 * and the browser checks read it, and log one line. Never sends real email.
 */
export const createLogSender = (opts: { appUrl: string }): Sender => ({
  name: "log",
  send: async (message) => {
    try {
      const [row] = await getDb()
        .insert(devMailSchema)
        .values({
          name: message.name,
          sender: message.from,
          recipient: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          idempotencyKey: message.idempotencyKey,
          createdBy: SYSTEM_USER.id,
          updatedBy: SYSTEM_USER.id,
        })
        .onConflictDoNothing({ target: devMailSchema.idempotencyKey })
        .returning({ id: devMailSchema.id });
      console.info(`[mail] ${message.name} to ${message.to}: "${message.subject}" → ${opts.appUrl}/dev/mail`);
      return { status: "sent", providerMessageId: row?.id };
    } catch (cause) {
      return { status: "error", error: cause instanceof Error ? cause.message : String(cause) };
    }
  },
});
