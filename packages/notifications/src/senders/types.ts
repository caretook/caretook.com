export type OutgoingMessage = {
  /** The notification's name, for logs and the dev mailbox. */
  name: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  /** The outbox row's key: Resend drops a second send with the same key. */
  idempotencyKey: string;
  /** Extra headers (`List-Unsubscribe`), from the notification's `headers`. */
  headers?: Record<string, string>;
};

export type SendResult =
  | { status: "sent"; providerMessageId?: string }
  /** Deliberately not sent (an address off the allowlist outside production). */
  | { status: "skipped"; reason: string }
  /** The provider refused or failed; the outbox retries later. */
  | { status: "error"; error: string };

export type Sender = {
  name: string;
  send: (message: OutgoingMessage) => Promise<SendResult>;
};
