import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, emailOTP, jwt, magicLink } from "better-auth/plugins";
import {
  accountSchema,
  getDb,
  jwksSchema,
  sessionSchema,
  SYSTEM_USER,
  USER_ROLE_NAMES,
  userSchema,
  verificationSchema,
} from "@caretook/data";
import { getAuthConfig } from "./config";
import { sendMagicLink, sendResetPassword, sendVerificationEmail, sendVerificationOTP } from "./emails";

// Capacitor's WebView origins. The native app talks to the web server's /api/auth.
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

// The email-OTP plugin's endpoints we don't use: a code only signs in.
// Resets go through the emailed link, and verification through its own link.
const UNUSED_OTP_PATHS = [
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];

const createAuth = () => {
  const { secret, baseURL, trustedOrigins, powersyncURL } = getAuthConfig();
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  return betterAuth({
    appName: "Caretook",
    secret,
    baseURL,
    trustedOrigins: [...NATIVE_ORIGINS, ...trustedOrigins],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: userSchema,
        session: sessionSchema,
        account: accountSchema,
        verification: verificationSchema,
        jwks: jwksSchema,
      },
    }),
    advanced: {
      // Our tables use uuid ids with gen_random_uuid() defaults.
      database: { generateId: "uuid" },
    },
    disabledPaths: UNUSED_OTP_PATHS,
    // Accounts come only from invitations (invites slices 3–5), never from
    // public sign-up. An unverified account can't sign in with a password:
    // it gets a fresh verification email and EMAIL_NOT_VERIFIED instead.
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword,
    },
    emailVerification: {
      sendVerificationEmail,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
    },
    user: {
      additionalFields: {
        // `input: false`: never settable from a sign-up or update request.
        role: { type: [...USER_ROLE_NAMES], input: false, defaultValue: "member" },
        // Our audit columns. Accounts created by the auth flow are made by the system.
        createdBy: { type: "string", input: false, returned: false, defaultValue: SYSTEM_USER.id },
        updatedBy: { type: "string", input: false, returned: false, defaultValue: SYSTEM_USER.id },
      },
    },
    // No usage data leaves our servers (see Compliance in AGENTS.md).
    telemetry: { enabled: false },
    plugins: [
      // `Authorization: Bearer <session token>` for Capacitor, where cookies don't work.
      bearer(),
      // "Email me a link" and "Email me a code": existing accounts only.
      magicLink({ disableSignUp: true, expiresIn: 5 * 60, storeToken: "hashed", sendMagicLink }),
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP,
      }),
      // Short-lived JWTs (and a JWKS endpoint) for PowerSync and workers.
      jwt({
        jwt: {
          // PowerSync only accepts tokens addressed to it (its instance URL on Cloud).
          ...(powersyncURL ? { audience: powersyncURL } : {}),
          expirationTime: "15m",
          definePayload: ({ user }) => ({ sub: user.id, role: (user as { role?: string }).role }),
        },
      }),
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** The Better Auth instance, created on first use (it needs env vars and the db). */
export const getAuth = () => (auth ??= createAuth());
