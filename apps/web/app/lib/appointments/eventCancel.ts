import { TIMELINE_LIMITS } from "@caretook/data/schema";
import { dayLabel } from "../core/format";

// Cancelling an event and putting it back: the fields each writes, and the
// words the entry page's Cancelled banner shows. Pure; unit-tested in
// web:unit. Who cancelled (`cancelledBy`) is the server's to set.

type Where = { locale?: string; timeZone?: string };

/** A typed reason, trimmed and capped; empty is none. */
export const cancelReasonOf = (reason: string | null | undefined) => {
  const text = reason?.trim().slice(0, TIMELINE_LIMITS.cancelReason) ?? "";
  return text || null;
};

/** The update that cancels an event now, with an optional reason. */
export const cancelPatch = (reason: string | null | undefined, now = new Date()) => ({
  cancelledAt: now.toISOString(),
  cancelReason: cancelReasonOf(reason),
});

/** The update that undoes a cancel: the reason and any "rescheduled to" go with it. */
export const UNCANCEL_PATCH = { cancelledAt: null, cancelReason: null, rescheduledTo: null } as const;

/**
 * The banner's line: "Cancelled by Maria Lopez · Today, 2:15 PM" (the name
 * left out when it isn't known, the time when there's none).
 */
export const cancelledByLine = (
  { cancelledAt, byName }: { cancelledAt: string | null; byName: string | null },
  now: Date,
  { locale, timeZone }: Where = {},
) => {
  const head = byName ? `Cancelled by ${byName}` : "Cancelled";
  if (!cancelledAt) return head;
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: zone }).format(
    new Date(cancelledAt),
  );
  return `${head} · ${dayLabel(cancelledAt, zone, now, locale)}, ${time}`;
};
