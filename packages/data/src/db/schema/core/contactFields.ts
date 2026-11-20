import { z } from "zod";
import { providerPhoneZSchema } from "../providers/provider";

// Contact fields shared by the recipient's details, members' own contact
// details and outside emergency contacts (profiles). Client-safe: the same
// rules run in forms and in the services.

export const CONTACT_LIMITS = {
  phones: 6,
  email: 254,
  address: 500,
  name: 120,
  relationship: 60,
} as const;

/** A labelled phone number ("Mobile", "Home"): the providers' shape. */
export type ContactPhone = { label: string; number: string };

/** Optional text: trimmed, and empty means none (null). */
export const optionalTextZSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `At most ${max} characters` })
    .nullish()
    .transform((v) => (v ? v : null));

/** One phone number as typed: digits, the usual separators, an optional + or extension. */
export const phoneNumberZSchema = providerPhoneZSchema.shape.number;

/** Up to six labelled phone numbers. */
export const contactPhonesZSchema = z
  .array(providerPhoneZSchema)
  .max(CONTACT_LIMITS.phones, { error: `At most ${CONTACT_LIMITS.phones} phone numbers` });

/** An optional email address: empty means none. */
export const optionalEmailZSchema = optionalTextZSchema(CONTACT_LIMITS.email).refine(
  (v) => v === null || z.email().safeParse(v).success,
  { error: "Enter an email address" },
);

/** An optional multi-line address. */
export const optionalAddressZSchema = optionalTextZSchema(CONTACT_LIMITS.address);
