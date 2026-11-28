import type { CreateSignInCode } from "./emails";
import type { AuthLimits } from "./limits";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, emailOTP, jwt, magicLink } from "better-auth/plugins";
import {
  accountSchema,
  getDb,
  JWKS_GRACE_SECONDS,
  jwksSchema,
  rateLimitSchema,
  sessionSchema,
  SYSTEM_USER,
  USER_ROLE_NAMES,
  userSchema,
  verificationSchema,
} from "@caretook/data";
import { getAuthConfig } from "./config";
import {
  CONNECTOR_DISABLED_PATHS,
  connectorAuthSchema,
  connectorOAuthProvider,
  connectorTokens,
} from "./connectors";
import { isDisabledEmail, isDisabledUser, noSession, wrongCode, wrongPassword } from "./disabled";
import { sendResetPassword, sendSignInEmail, sendVerificationEmail, sendVerificationOTP } from "./emails";
import { allowedOrigins, clientIpHeader, clientIpKey, clientIpOf } from "./host";
import { addressKey, CONNECTOR_IP_LIMIT, createAuthLimits } from "./limits";
import { readsLiveSession } from "./liveSession";
import { afterHooks, disconnectAssistants } from "./sessionsEnded";

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

/** The body's `email`, when the request has one. */
const bodyEmail = (body: unknown) =>
  body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email : null;

/**
 * Password and code sign-in for a disabled account (admin PRD, slice 3)
 * answer before Better Auth looks further, exactly as a wrong password or
 * code would: an unconfirmed account would otherwise get "not verified"
 * (and a new link), which says the password was right. The password is
 * hashed anyway, as Better Auth does for an unknown address, so the answer
 * takes as long. The session hook below is the backstop for every path.
 */
const refuseDisabledSignIn = async (
  path: string,
  body: unknown,
  hash: (password: string) => Promise<unknown>,
) => {
  if (path !== "/sign-in/email" && path !== "/sign-in/email-otp") return;
  const email = bodyEmail(body);
  if (!email || !(await isDisabledEmail(email))) return;
  if (path === "/sign-in/email-otp") throw wrongCode();
  const password = (body as { password?: unknown }).password;
  if (typeof password === "string") await hash(password);
  throw wrongPassword();
};

// Better Auth's own endpoints we don't serve. Name and image change only
// through our procedures, which validate them (B-335): Better Auth's
// /update-user takes any name or image, which syncs to co-members and goes
// into the owners' emails.
const UNUSED_USER_PATHS = ["/update-user"];

/**
 * Our per-address limits on the sign-in email and code sign-in (limits.ts).
 * Past the email's, the answer is the usual one and nothing is sent or
 * minted (the request stops here, before the link's token exists); past the
 * code's, it's a wrong code's, even for the right code.
 */
const limitSignIn = async (
  limits: AuthLimits,
  path: string,
  body: unknown,
): Promise<{ status: true } | undefined> => {
  if (path !== "/sign-in/magic-link" && path !== "/sign-in/email-otp") return;
  const email = bodyEmail(body);
  if (!email) return;
  if (path === "/sign-in/magic-link") {
    return (await limits.hit("signInEmail", addressKey(email))) ? undefined : { status: true };
  }
  if (!(await limits.hit("signInCode", addressKey(email)))) throw wrongCode();
};

/**
 * A connector client's registration (`/oauth2/register`, open to anyone) is
 * limited per client IP (`clientIpKey`), as /mcp is: past it a 429 with
 * Retry-After, and in production a request without a client IP is a 400.
 */
const limitRegistration = async (limits: AuthLimits, path: string, headers: Headers | undefined) => {
  if (path !== "/oauth2/register") return;
  const ip = clientIpKey(clientIpOf(headers ?? new Headers()), "auth.oauth2Register");
  if (ip === null) throw APIError.from("BAD_REQUEST", { code: "BAD_REQUEST", message: "Bad Request" });
  if (await limits.hit("connectorRegisterIp", ip)) return;
  throw new APIError(
    "TOO_MANY_REQUESTS",
    { code: "TOO_MANY_REQUESTS", message: "Too many requests: wait a minute" },
    { "retry-after": String(CONNECTOR_IP_LIMIT.windowMs / 1000) },
  );
};

/**
 * Before every endpoint. PowerSync's token (`/token`, the jwt plugin)
 * always reads the live session, never the cookie cache, whatever the
 * request's query says (B-140): a revoked session can't open a new sync
 * connection. The path is matched exactly (liveSession.ts). Sign-in counts
 * toward our limits and refuses a disabled account (above).
 */
const beforeHooks = (limits: AuthLimits) =>
  createAuthMiddleware(async (ctx) => {
    if (readsLiveSession(ctx.path)) return { context: { query: { ...ctx.query, disableCookieCache: true } } };
    await limitRegistration(limits, ctx.path, ctx.headers);
    const answer = await limitSignIn(limits, ctx.path, ctx.body);
    if (answer) return ctx.json(answer);
    await refuseDisabledSignIn(ctx.path, ctx.body, (password) => ctx.context.password.hash(password));
  });

/**
 * A new Better Auth instance. The app uses `getAuth()`'s one; tests make
 * more (two instances stand for two serverless instances), and
 * `rateLimitEnabled` turns the limits on outside production: Better Auth's
 * and our per-address ones (limits.ts). `originCheck`
 * turns on the Origin check Better Auth skips under `NODE_ENV=test`.
 * `limits` replaces our limits alone (a test's, on, with lower counts).
 */
export const createAuth = ({
  rateLimitEnabled,
  originCheck,
  limits: ourLimits,
}: { rateLimitEnabled?: boolean; originCheck?: boolean; limits?: AuthLimits } = {}) => {
  const { secret, secrets, baseURL, powersyncURL } = getAuthConfig();
  const ipHeader = clientIpHeader();
  if (!secret && !secrets) throw new Error("BETTER_AUTH_SECRET is not set");
  const limits =
    ourLimits ?? createAuthLimits(rateLimitEnabled === undefined ? {} : { enabled: rateLimitEnabled });

  // Set once the instance exists: the email's code comes from its own
  // email-OTP plugin (typed here, so the instance's type doesn't loop).
  let createSignInCode: CreateSignInCode = () => Promise.reject(new Error("auth isn't ready"));

  const instance = betterAuth({
    appName: "Caretook",
    // With a list (BETTER_AUTH_SECRETS), its first entry is current: it signs
    // session cookies and bearer tokens (checked against it alone, so making
    // a new one current signs everyone out) and encrypts new data, which
    // records its version; every listed version, and the legacy `secret` for
    // data from before the list, still decrypt (the JWKS private key). See
    // ops/runbook.md, _Rotation_.
    ...(secret ? { secret } : {}),
    ...(secrets ? { secrets } : {}),
    baseURL,
    // The native app (its WebView talks to /api/auth) only with NATIVE_APP_ORIGINS=1.
    trustedOrigins: allowedOrigins(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: userSchema,
        session: sessionSchema,
        account: accountSchema,
        verification: verificationSchema,
        jwks: jwksSchema,
        rateLimit: rateLimitSchema,
        ...connectorAuthSchema,
      },
    }),
    // Better Auth's limits (on only with NODE_ENV=production, check builds
    // included; get-session 100 per 10 s per client IP, sign-in 3 per 10 s),
    // counted in Postgres (`rate_limit`) so every serverless instance shares
    // them. Old rows go in the outbox cron's sweep (rateLimitService.purge).
    rateLimit: {
      storage: "database",
      ...(rateLimitEnabled === undefined ? {} : { enabled: rateLimitEnabled }),
    },
    advanced: {
      // Our tables use uuid ids with gen_random_uuid() defaults.
      database: { generateId: "uuid" },
      // The limits key on the host's client-IP header (CLIENT_IP_HEADER), as
      // /rpc's do (host.ts); unset, Better Auth's default, x-forwarded-for.
      ...(ipHeader ? { ipAddress: { ipAddressHeaders: [ipHeader] } } : {}),
      ...(originCheck === undefined ? {} : { disableOriginCheck: !originCheck }),
    },
    disabledPaths: [...UNUSED_OTP_PATHS, ...UNUSED_USER_PATHS, ...CONNECTOR_DISABLED_PATHS],
    // After: ending other or all sessions ends the account's assistants too (sessionsEnded.ts).
    hooks: { before: beforeHooks(limits), after: afterHooks },
    // A disabled account never gets a session, by any path (password, link,
    // code, verification's auto sign-in): the answer is a wrong password's.
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (await isDisabledUser(session.userId)) throw wrongPassword();
          },
        },
      },
    },
    // Account settings' Devices page lists the account's sessions. Better
    // Auth's list-sessions refuses a session older than `freshAge` (a day by
    // default), which would hide the list from anyone signed in for longer.
    // Nothing else we use checks freshness (deleteUser and unlink-account are off).
    //
    // The cookie cache (B-140): a signed copy of the session in a cookie
    // stands in for Better Auth's own session read for up to 3 minutes.
    // getAuthUser still joins the live session row by id in its one query
    // (B-339), so a session revoked elsewhere is refused on the next /rpc
    // call. Staff procedures, /token (above) and the app's own session check
    // also bypass the cache. See docs/domain/auth.md.
    session: { freshAge: 0, cookieCache: { enabled: true, maxAge: 180 } },
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
      // A reset ends every session (above) and every assistant's connection (B-329).
      onPasswordReset: ({ user }) => disconnectAssistants(user.id),
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
      // `Authorization: Bearer <session token>` for Capacitor, where cookies
      // don't work. Only the signed token (the `set-auth-token` header) is
      // accepted, never the raw one stored in the session table (B-330): a
      // copy of that table is no account takeover without the secret.
      bearer({ requireSignature: true }),
      // "Send email": one email with the link and a code
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
        // No `set-auth-jwt` header on every get-session (nothing reads it):
        // /token mints them. Signing one cost each /rpc lookup a key read
        // and a disabled-account check, and failed it for a disabled one (B-140).
        disableSettingJwtHeader: true,
        // `pnpm auth:rotate-jwks` expires the signing key; the next token
        // makes a new one. The old public key stays in the JWKS for an hour,
        // so tokens it signed (15 minutes at most) verify until they expire.
        jwks: { gracePeriod: JWKS_GRACE_SECONDS },
        jwt: {
          // PowerSync only accepts tokens addressed to it (its instance URL on Cloud).
          ...(powersyncURL ? { audience: powersyncURL } : {}),
          expirationTime: "15m",
          // No token for a disabled account (its sessions are gone too; this
          // covers a request already under way): the answer is "no session".
          definePayload: async ({ user }) => {
            if (await isDisabledUser(user.id)) throw noSession();
            return { sub: user.id, role: (user as { role?: string }).role };
          },
        },
      }),
      // Members' own AI assistants (connectors PRD): OAuth 2.1 for /mcp.
      connectorOAuthProvider(baseURL ?? "http://localhost:5173"),
      connectorTokens(baseURL ?? "http://localhost:5173"),
    ],
  });
  createSignInCode = (email) => instance.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  return instance;
};

export type Auth = ReturnType<typeof createAuth>;

let auth: Auth | undefined;

/** The Better Auth instance, created on first use (it needs env vars and the db). */
export const getAuth = () => (auth ??= createAuth());
