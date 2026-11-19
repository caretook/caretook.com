import type { SignInMethod } from "~/lib/accountUrls";
import type { Route } from "./+types/sign-in";

import { Form, Link, redirect, useNavigation } from "react-router";
import { accountUrls, parseSignInMethod } from "~/lib/accountUrls";
import { authClient } from "~/lib/auth-client";
import { authMessages, isCodeShaped, isUnverified, normalizeCode, requestFailure } from "~/lib/authMessages";
import { formString } from "~/lib/form";
import { safeRedirect } from "~/lib/redirect";
import { AuthCard, useSubmitOnce, EmailField, ErrorMessage, StatusMessage } from "./account/AuthCard";

// Shared by web + native: client-only, like every /app route.
//
// Three ways in, chosen by `?with=`: a password (the default), a link by
// email (`link`) or a 6-digit code by email (`code`). Every message about an
// address is the same whether or not it has an account (lib/authMessages).
// Each submit button stays disabled while any navigation is busy, so nothing
// can be sent twice (B-1).

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in · Caretook" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const redirectTo = safeRedirect(params.get("redirectTo"));
  const { data } = await authClient.getSession();
  if (data) throw redirect(redirectTo);
  return {
    redirectTo,
    method: parseSignInMethod(params.get("with")),
    // Better Auth sends an expired or used magic link back here.
    linkExpired: params.has("expired") || params.has("error"),
  };
}

type ActionData = { intent: SignInMethod; sentTo?: string; error?: string };

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const intent = formString(form, "intent");
  const email = formString(form, "email").trim();
  const redirectTo = safeRedirect(formString(form, "redirectTo"));

  if (intent === "link") {
    const { error } = await authClient.signIn.magicLink({
      email,
      callbackURL: redirectTo,
      errorCallbackURL: accountUrls.magicLinkError(),
    });
    const failure = requestFailure(error);
    return failure ? { intent, error: failure } : { intent, sentTo: email };
  }

  if (intent === "send-code") {
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    const failure = requestFailure(error);
    return failure ? { intent: "code", error: failure } : { intent: "code", sentTo: email };
  }

  if (intent === "code") {
    const code = normalizeCode(formString(form, "code"));
    if (!isCodeShaped(code)) return { intent, sentTo: email, error: authMessages.wrongCode };
    const { error } = await authClient.signIn.emailOtp({ email, otp: code });
    if (error) return { intent, sentTo: email, error: requestFailure(error) ?? authMessages.wrongCode };
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
  throw redirect(redirectTo);
}

const METHODS: { method: SignInMethod; label: string }[] = [
  { method: "password", label: "Password" },
  { method: "link", label: "Email link" },
  { method: "code", label: "Email code" },
];

export default function SignIn({ loaderData, actionData }: Route.ComponentProps) {
  const { redirectTo, method, linkExpired } = loaderData;
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
      <nav aria-label="Ways to sign in" className="tabs tabs-box tabs-sm grid grid-cols-3">
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
          <fieldset className="fieldset">
            <label className="fieldset-legend" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input w-full"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </fieldset>
          {result?.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="pt-2 text-center text-sm">
            <Link to={accountUrls.resetPassword()} className="link">
              Forgot password?
            </Link>
          </p>
        </Form>
      )}

      {method === "link" && (
        <Form method="post" onSubmit={submitOnce} className="space-y-1">
          <input type="hidden" name="intent" value="link" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {linkExpired && !result && <ErrorMessage>{authMessages.linkExpired}</ErrorMessage>}
          {result?.sentTo ? (
            <StatusMessage>{authMessages.linkSent(result.sentTo)}</StatusMessage>
          ) : (
            <p className="text-base-content/70 text-sm">
              We'll email you a link that signs you in, no password needed.
            </p>
          )}
          <EmailField defaultValue={result?.sentTo} />
          {result?.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
            {busy ? "Sending…" : result?.sentTo ? "Send another link" : "Email me a link"}
          </button>
        </Form>
      )}

      {method === "code" && !result?.sentTo && (
        <Form method="post" onSubmit={submitOnce} className="space-y-1">
          <input type="hidden" name="intent" value="send-code" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <p className="text-base-content/70 text-sm">We'll email you a 6-digit code to type in here.</p>
          <EmailField />
          {result?.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </Form>
      )}

      {method === "code" && result?.sentTo && (
        <div className="space-y-3">
          <StatusMessage>{authMessages.codeSent(result.sentTo)}</StatusMessage>
          <Form method="post" onSubmit={submitOnce} className="space-y-1">
            <input type="hidden" name="intent" value="code" />
            <input type="hidden" name="email" value={result.sentTo} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <fieldset className="fieldset">
              <label className="fieldset-legend" htmlFor="code">
                Code
              </label>
              <input
                id="code"
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
            </fieldset>
            {result.error && <ErrorMessage>{result.error}</ErrorMessage>}
            <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
              {busy && busyIntent === "code" ? "Signing in…" : "Sign in"}
            </button>
          </Form>
          <Form method="post" onSubmit={submitOnce} className="text-center">
            <input type="hidden" name="intent" value="send-code" />
            <input type="hidden" name="email" value={result.sentTo} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" className="btn btn-ghost btn-sm" disabled={busy}>
              {busy && busyIntent === "send-code" ? "Sending…" : "Send a new code"}
            </button>
          </Form>
        </div>
      )}
    </AuthCard>
  );
}
