import { getDb, userSchema } from "@caretook/data";
import { APIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";

// Disabled accounts (admin PRD, slice 3). Staff disable an account through
// accountAdminService, which signs every session out in the same
// transaction; this is how Better Auth then refuses it, in one place:
// session creation, password and code sign-in, sync tokens, getAuthUser and
// the auth emails. Every refusal reads exactly as a wrong password, a wrong
// code, no session or an unknown address would, so nobody learns that the
// account exists or was disabled.

/** Whether the account with this id is disabled. */
export const isDisabledUser = async (userId: string) => {
  const [row] = await getDb()
    .select({ disabledAt: userSchema.disabledAt })
    .from(userSchema)
    .where(eq(userSchema.id, userId))
    .limit(1);
  return Boolean(row?.disabledAt);
};

/** Whether the account at this address (any case) is disabled; false for an unknown address. */
export const isDisabledEmail = async (email: string) => {
  const [row] = await getDb()
    .select({ disabledAt: userSchema.disabledAt })
    .from(userSchema)
    .where(eq(sql`lower(${userSchema.email})`, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(row?.disabledAt);
};

/** Better Auth's own answer to a wrong password or an unknown address. */
export const wrongPassword = () =>
  APIError.from("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" });

/** The email-OTP plugin's answer to a wrong code. */
export const wrongCode = () => APIError.from("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });

/** Better Auth's answer to a request without a session (`/token`, for one). */
export const noSession = () =>
  APIError.from("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "Unauthorized" });
