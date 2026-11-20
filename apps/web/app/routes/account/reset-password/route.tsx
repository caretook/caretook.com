import type { Route } from "./+types/route";

import { Form, Link, useNavigation } from "react-router";
import { Field } from "~/components/ui/plain";
import { accountUrls } from "~/lib/auth/accountUrls";
import { authClient } from "~/lib/auth/auth-client";
import {
  authMessages,
  isBadToken,
  MIN_PASSWORD_LENGTH,
  newPasswordProblem,
  requestFailure,
} from "~/lib/auth/authMessages";
import { formString } from "~/lib/core/form";
import { AuthCard, useSubmitOnce, EmailField, ErrorMessage, StatusMessage } from "../AuthCard";

// Shared by web + native: client-only. "Forgot password?" on sign-in opens it
// without a token: it asks for the email and sends a link (the message is
// the same whether or not the address has an account). The emailed link
// opens it with `?token=`: choose a new password. The link works once, and
// the change signs the account out everywhere.

export function meta({}: Route.MetaArgs) {
  return [{ title: "Reset your password · Caretook" }];
}

export function clientLoader({ request }: Route.ClientLoaderArgs) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  return { token: token || null };
}

type ActionData =
  | { intent: "request"; sentTo?: string; error?: string }
  | { intent: "set"; done?: true; expired?: true; error?: string };

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionData> {
  const form = await request.formData();
  if (formString(form, "intent") === "set") {
    const newPassword = formString(form, "password");
    const problem = newPasswordProblem(newPassword, formString(form, "confirm"));
    if (problem) return { intent: "set", error: problem };
    const { error } = await authClient.resetPassword({ newPassword, token: formString(form, "token") });
    if (!error) return { intent: "set", done: true };
    if (isBadToken(error)) return { intent: "set", expired: true };
    return { intent: "set", error: requestFailure(error) ?? error.message ?? authMessages.failed };
  }

  const email = formString(form, "email").trim();
  const { error } = await authClient.requestPasswordReset({ email, redirectTo: accountUrls.resetPassword() });
  const failure = requestFailure(error);
  return failure ? { intent: "request", error: failure } : { intent: "request", sentTo: email };
}

export default function ResetPassword({ loaderData, actionData }: Route.ComponentProps) {
  const { token } = loaderData;
  const busy = useNavigation().state !== "idle";
  const submitOnce = useSubmitOnce();
  const result = actionData?.intent === (token ? "set" : "request") ? actionData : undefined;

  if (token && result && "done" in result && result.done) {
    return (
      <AuthCard title="Password changed">
        <StatusMessage>{authMessages.passwordChanged}</StatusMessage>
        <Link to={accountUrls.signIn()} className="btn btn-primary btn-block">
          Sign in
        </Link>
      </AuthCard>
    );
  }

  if (token && !(result && "expired" in result && result.expired)) {
    return (
      <AuthCard title="Choose a new password">
        <Form method="post" onSubmit={submitOnce} className="space-y-1">
          <input type="hidden" name="intent" value="set" />
          <input type="hidden" name="token" value={token} />
          <Field
            label="New password"
            help={`At least ${MIN_PASSWORD_LENGTH} characters. A few words you'll remember work well.`}
          >
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            )}
          </Field>
          <Field label="Type it again">
            {(control) => (
              <input
                {...control}
                className="input w-full"
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
              />
            )}
          </Field>
          {result && "error" in result && result.error && <ErrorMessage>{result.error}</ErrorMessage>}
          <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </Form>
      </AuthCard>
    );
  }

  const expired = Boolean(token);
  const sentTo = result && "sentTo" in result ? result.sentTo : undefined;
  const error = result && "error" in result ? result.error : undefined;
  return (
    <AuthCard title="Reset your password">
      {expired && !sentTo && <ErrorMessage>{authMessages.resetExpired}</ErrorMessage>}
      {sentTo ? (
        <StatusMessage>{authMessages.resetSent(sentTo)}</StatusMessage>
      ) : (
        <p className="text-sm">Enter your email and we'll send you a link to choose a new password.</p>
      )}
      <Form method="post" onSubmit={submitOnce} action={accountUrls.resetPassword()} className="space-y-1">
        <input type="hidden" name="intent" value="request" />
        <EmailField defaultValue={sentTo} />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
          {busy ? "Sending…" : sentTo ? "Send another link" : "Email me a link"}
        </button>
      </Form>
      <p className="text-center text-sm">
        <Link to={accountUrls.signIn()} className="link">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
