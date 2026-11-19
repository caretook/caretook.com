import type { CreateSignInCode } from "./emails";

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
import { sendResetPassword, sendSignInEmail, sendVerificationEmail, sendVerificationOTP } from "./emails";

// Capacitor's WebView origins. The native app talks to the web server's /api/auth.
const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

// The email-OTP plugin's endpoints we don't use: a code only signs in.
// Resets go through the emailed link, and verification through its own link.
// Codes are sent only with the sign-in link (B-96), never on their own.
const UNUSED_OTP_PATHS = [
  "/email-otp/send-verification-otp",
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

  // Set once the instance exists: the email's code comes from its own
  // email-OTP plugin (typed here, so the instance's type doesn't loop).
  let createSignInCode: CreateSignInCode = () => Promise.reject(new Error("auth isn't ready"));

  const instance = betterAuth({
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
      // "Email me a sign-in link": one email with the link and a code
      // (B-96), existing accounts only.
      magicLink({
        disableSignUp: true,
        expiresIn: 5 * 60,
        storeToken: "hashed",
        sendMagicLink: (data) => sendSignInEmail(data, (email) => createSignInCode(email)),
      }),
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
  createSignInCode = (email) => instance.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  return instance;
};

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** The Better Auth instance, created on first use (it needs env vars and the db). */
export const getAuth = () => (auth ??= createAuth());
