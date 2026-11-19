import { z } from "zod";
import {
  CARING_FOR,
  CONTACT_MESSAGE_MAX,
  CONTACT_TOPICS,
  EMAIL_MAX,
  HEARD_FROM_MAX,
  HONEYPOT_FIELD,
  NAME_MAX,
  SOURCE_FIELD_MAX,
} from "./publicFormRules";

// The marketing site's public forms' Zod schemas (marketing slice 4): the
// waitlist and contact. Client-safe, but the site's form components import
// only publicFormRules.ts (so Zod stays off the page); the API validates with
// these, and the services again.

/** The spam fields every public form sends beside its own. */
const guardFields = {
  [HONEYPOT_FIELD]: z.string().max(1000).optional(),
  /** Milliseconds between the form showing and its submit, by the browser's clock. */
  elapsedMs: z.number().int().min(0).max(1_000_000_000).optional(),
};

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/** An address as stored and compared: trimmed and lowercased. */
export const publicEmailZ = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter an email address, like name@example.com").max(EMAIL_MAX, "That address is too long"));

/** Optional free text: blank becomes undefined. */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .optional()
    .transform((value) => value || undefined);

/** An optional choice from `values`; the form's empty option ("") is none. */
const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal("")])
    .optional()
    .transform((value) => value || undefined);

const sourceText = z.string().trim().max(SOURCE_FIELD_MAX).optional();

/** Where someone joined from: the page and any UTM parameters in its URL. */
export const waitlistSourceZSchema = z.object({
  page: sourceText,
  utmSource: sourceText,
  utmMedium: sourceText,
  utmCampaign: sourceText,
  utmTerm: sourceText,
  utmContent: sourceText,
});

/** The waitlist form: an email, and optionally a first name, who they care for and how they heard. */
export const waitlistJoinZSchema = z.object({
  email: publicEmailZ,
  firstName: optionalText(NAME_MAX, "Keep your name under 100 characters"),
  caringFor: optionalChoice(CARING_FOR),
  heardFrom: optionalText(HEARD_FROM_MAX, `Keep it under ${HEARD_FROM_MAX} characters`),
  source: waitlistSourceZSchema.optional(),
  ...guardFields,
});
export type WaitlistJoinInput = z.input<typeof waitlistJoinZSchema>;
export type WaitlistJoin = z.output<typeof waitlistJoinZSchema>;

/** The contact form: everything required. */
export const contactSendZSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(NAME_MAX, "Keep your name under 100 characters"),
  email: publicEmailZ,
  topic: z.enum(CONTACT_TOPICS, "Choose what it's about"),
  message: z
    .string()
    .trim()
    .min(1, "Write your message")
    .max(CONTACT_MESSAGE_MAX, `Keep it under ${CONTACT_MESSAGE_MAX.toLocaleString("en-US")} characters`),
  ...guardFields,
});
export type ContactSendInput = z.input<typeof contactSendZSchema>;
export type ContactSend = z.output<typeof contactSendZSchema>;
