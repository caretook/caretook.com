import { z } from "zod";
import { staffReasonZSchema } from "./staffRules";

// Staff account help (admin PRD, slice 2): the inputs of /admin/users and an
// account's page, and how a sent email's failure reads there. Pure and
// client-safe: the service, the API and the pages share it.

/** Accounts per page on /admin/users. */
export const ACCOUNT_PAGE_SIZE = 50;

/** The most recent emails an account's page lists. */
export const RECENT_MAIL_LIMIT = 20;

/** A search: part of a name or email (none lists every account), and a page. */
export const accountSearchZSchema = z.object({
  q: z.string().trim().max(254).optional(),
  page: z.number().int().min(1).max(100_000).default(1),
});
export type AccountSearchInput = z.input<typeof accountSearchZSchema>;

/** A help action on one account: who, and why (1–500 characters). */
export const accountHelpZSchema = z.object({
  userId: z.uuid(),
  reason: staffReasonZSchema,
});
export type AccountHelpInput = z.input<typeof accountHelpZSchema>;

/** Signing out one of an account's sessions. */
export const revokeSessionZSchema = accountHelpZSchema.extend({ sessionId: z.uuid() });
export type RevokeSessionInput = z.input<typeof revokeSessionZSchema>;

/**
 * A short code for why an email wasn't sent, never the sender's whole
 * message (it can quote the address or the provider's details): a skip
 * outside production is `notAllowlisted`; a provider error's name
 * (Resend's `validation_error: …` → `validation_error`); anything else
 * `error`. Null when there was none.
 */
export const mailErrorCode = (status: string, lastError: string | null | undefined) => {
  if (!lastError) return null;
  if (status === "skipped") return /allowlist/i.test(lastError) ? "notAllowlisted" : "skipped";
  return /^([A-Za-z][\w.-]{0,40}):/.exec(lastError)?.[1] ?? "error";
};
