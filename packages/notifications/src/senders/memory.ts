import type { OutgoingMessage, Sender } from "./types";

export type MemorySender = Sender & {
  /** Every message sent, oldest first. */
  sent: OutgoingMessage[];
  clear: () => void;
};

/**
 * For tests: keeps messages in an array. `fail` makes a send return an error
 * (a provider hiccup), and `delayMs` holds each send (to test concurrency).
 */
export const createMemorySender = (
  opts: { fail?: (message: OutgoingMessage) => boolean; delayMs?: number } = {},
): MemorySender => {
  const sent: OutgoingMessage[] = [];
  return {
    name: "memory",
    sent,
    clear: () => void sent.splice(0),
    send: async (message) => {
      if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      if (opts.fail?.(message)) return { status: "error", error: "memory sender: failing on purpose" };
      sent.push(message);
      return { status: "sent", providerMessageId: `memory-${sent.length}` };
    },
  };
};

// The process-wide memory sender MAIL_SENDER=memory uses.
let shared: MemorySender | undefined;
export const sharedMemorySender = () => (shared ??= createMemorySender());
