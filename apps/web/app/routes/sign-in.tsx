import type { SignInMethod } from "~/lib/auth/accountUrls";
import type { Route } from "./+types/sign-in";

import { Form, Link, redirect, useNavigation } from "react-router";
import { Button, Field } from "~/components/ui/plain";
import { accountUrls, parseSignInMethod } from "~/lib/auth/accountUrls";
import { authClient } from "~/lib/auth/auth-client";
import { sessionChanged } from "~/lib/auth/sessionEpoch";
import {
  authMessages,
  isCodeShaped,
  isUnverified,
  normalizeCode,
  requestFailure,
} from "~/lib/auth/authMessages";
import { formString } from "~/lib/core/form";
import { safeRedirect } from "~/lib/core/redirect";
import { AuthCard, useSubmitOnce, EmailField, ErrorMessage, StatusMessage } from "./account/AuthCard";

// Shared by web + native: client-only, like every /app route.
//
// Two ways in, chosen by `?with=`: a password (the default), or `email`: one
// email with a sign-in link and a 6-digit code (B-96), so the code works when
// the email is opened on another device. Every message about an
// address is the same whether or not it has an account (lib/auth/authMessages).
// Each submit button stays disabled while any navigation is busy, so nothing
// can be sent twice (B-1).

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in · Caretook" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const redirectTo = safeRedirect(params.get("redirectTo"));
  // Offline (the request throws), there's no session to skip ahead with.
  const { data } = await authClient.getSession().catch(() => ({ data: null }));
  if (data) throw redirect(redirectTo);
  return {
    redirectTo,
    method: parseSignInMethod(params.get("with")),
    // Better Auth sends an expired or used magic link back here.
    linkExpired: params.has("expired") || params.has("error"),
    // The /app check sends a device offline for 3 days here (lib/auth/session).
    offlineTooLong: params.get("reason") === "offline",
    // A session check rate-limited twice, with nobody cached (lib/auth/session, B-130).
    rateLimited: params.get("reason") === "rate-limited",
  };
}

type ActionData = { intent: SignInMethod; sentTo?: string; error?: string };

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const intent = formString(form, "intent");
  const email = formString(form, "email").trim();
  const redirectTo = safeRedirect(formString(form, "redirectTo"));

  if (intent === "send-email") {
    // One request, one email: the server adds the code to the link's email.
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: redirectTo,
      errorCallbackURL: accountUrls.magicLinkError(),
    });
    const failure = requestFailure(error);
    return failure ? { intent: "email", error: failure } : { intent: "email", sentTo: email };
  }

  if (intent === "code") {
    const code = normalizeCode(formString(form, "code"));
    const failed = (error: string) => ({ intent: "email" as const, sentTo: email, error });
    if (!isCodeShaped(code)) return failed(authMessages.wrongCode);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    if (error) return failed(requestFailure(error) ?? authMessages.wrongCode);
    sessionChanged();
    throw redirect(redirectTo);
  }

  const { error } = await authClient.signIn.email({
    email,
    // No callbackURL: with one, Better Auth's client reloads the page itself,
    // which would undo the busy button (B-1). The router redirects instead.
    password: formString(form, "password"),
  });
  // The right password for an account that isn't verified yet: Better Auth
  // has just emailed a new link. Nobody gets here without the password.
  if (isUnverified(error)) throw redirect(accountUrls.verifyEmail(email, redirectTo));
  // One message for every other failure: don't reveal which emails have accounts.
  if (error) return { intent: "password", error: requestFailure(error) ?? authMessages.wrongPassword };
  sessionChanged();
  throw redirect(redirectTo);
}

const METHODS: { method: SignInMethod; label: string }[] = [
  { method: "password", label: "Password" },
  { method: "email", label: "Email" },
];

export default function SignIn({ loaderData, actionData }: Route.ComponentProps) {
  const { redirectTo, method, linkExpired, offlineTooLong, rateLimited } = loaderData;
  // Busy from submit until the navigation it starts is idle: a successful sign-in
  // redirects, and the state is "loading" while /app's loaders run (up to the first
  // sync), so checking only "submitting" would re-enable the button for a second
  // sign-in. An error returns to idle, which re-enables the form.
  const navigation = useNavigation();
  const submitOnce = useSubmitOnce();
  const busy = navigation.state !== "idle";
  const busyIntent = busy ? formString(navigation.formData ?? new FormData(), "intent") : "";
  const result = actionData?.intent === method ? actionData : undefined;

  return (
    <AuthCard title="Sign in to Caretook">
      {offlineTooLong && <StatusMessage>{authMessages.offlineTooLong}</StatusMessage>}
      {rateLimited && <StatusMessage>{authMessages.sessionRateLimited}</StatusMessage>}
      <nav aria-label="Ways to sign in" className="tabs tabs-box tabs-sm grid grid-cols-2">
        {METHODS.map((m) => (
          <Link
            key={m.method}
            to={accountUrls.signIn(m.method, redirectTo)}
            replace
            className={`tab ${m.method === method ? "tab-active" : ""}`}
            aria-current={m.method === method ? "page" : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>

      {method === "password" && (
        <Form method="post" onSubmit={submitOnce} className="space-y-1">
          <input type="hidden" name="intent" value="password" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <EmailField />
          <Field label="Password">
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            )}
          </Field>
          {result?.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <Button type="submit" variant="primary" block className="mt-2" busy={busy} busyLabel="Signing in…">
            Sign in
          </Button>
          <p className="pt-2 text-center text-sm">
            <Link to={accountUrls.resetPassword()} className="link">
              Forgot password?
            </Link>
          </p>
        </Form>
      )}

      {method === "email" && !result?.sentTo && (
        <Form method="post" onSubmit={submitOnce} className="space-y-1">
          <input type="hidden" name="intent" value="send-email" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {linkExpired && !result && <ErrorMessage>{authMessages.linkExpired}</ErrorMessage>}
          <EmailField />
          {result?.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <Button type="submit" variant="primary" block className="mt-2" busy={busy} busyLabel="Sending…">
            Send email
          </Button>
        </Form>
      )}

      {method === "email" && result?.sentTo && (
        <div className="space-y-3">
          <StatusMessage>{authMessages.signInSent(result.sentTo)}</StatusMessage>
          <Form method="post" onSubmit={submitOnce} className="space-y-1">
            <input type="hidden" name="intent" value="code" />
            <input type="hidden" name="email" value={result.sentTo} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Field label="Code">
              {(control) => (
                <input
                  {...control}
                  className="input w-full text-center font-mono text-2xl tracking-[0.4em]"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\s*(\d\s*){6}"
                  maxLength={11}
                  // The code is the one thing to type next.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                />
              )}
            </Field>
            {result.error && <ErrorMessage>{result.error}</ErrorMessage>}
            <Button
              type="submit"
              variant="primary"
              block
              className="mt-2"
              busy={busy && busyIntent === "code"}
              disabled={busy}
              busyLabel="Signing in…"
            >
              Sign in
            </Button>
          </Form>
          <Form method="post" onSubmit={submitOnce} className="text-center">
            <input type="hidden" name="intent" value="send-email" />
            <input type="hidden" name="email" value={result.sentTo} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              busy={busy && busyIntent === "send-email"}
              disabled={busy}
              busyLabel="Sending…"
            >
              Send a new link and code
            </Button>
          </Form>
        </div>
      )}
    </AuthCard>
  );
}
