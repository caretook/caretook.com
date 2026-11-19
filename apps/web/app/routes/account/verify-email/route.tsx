import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/route";

import { Form, Link, useNavigation } from "react-router";
import { accountUrls } from "~/lib/accountUrls";
import { authClient } from "~/lib/auth-client";
import { authMessages, requestFailure } from "~/lib/authMessages";
import { formString } from "~/lib/form";
import { safeRedirect } from "~/lib/redirect";
import { AuthCard, useSubmitOnce, EmailField, ErrorMessage, StatusMessage } from "../AuthCard";

// Shared by web + native: client-only. Two ways in:
// - from the emailed link (`?token=`): the token is checked at once, which
//   confirms the address and signs the user in;
// - from sign-in, when the password was right but the address isn't
//   confirmed yet (`?email=`): Better Auth has just sent a link, and the
//   page offers to send another.
// An unverified account never reaches /app: Better Auth refuses its
// password sign-in, and lib/session.ts sends any such session here.

export function meta({}: Route.MetaArgs) {
  return [{ title: "Confirm your email · Caretook" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const next = safeRedirect(params.get("next"));
  const token = params.get("token");
  if (token) {
    const { error } = await authClient.verifyEmail({ query: { token } });
    if (error) return { state: "expired" as const, next, email: "", failure: requestFailure(error) };
    return { state: "verified" as const, next, email: "", failure: null };
  }
  return { state: "pending" as const, next, email: params.get("email")?.trim() ?? "", failure: null };
}

// Sending a new link mustn't check the token again.
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod ? false : defaultShouldRevalidate;
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const email = formString(form, "email").trim();
  const { error } = await authClient.sendVerificationEmail({
    email,
    callbackURL: safeRedirect(formString(form, "next")),
  });
  const failure = requestFailure(error);
  return failure ? { error: failure } : { sentTo: email };
}

export default function VerifyEmail({ loaderData, actionData }: Route.ComponentProps) {
  const { state, next, email, failure } = loaderData;
  const busy = useNavigation().state !== "idle";
  const submitOnce = useSubmitOnce();

  if (state === "verified") {
    return (
      <AuthCard title="Email confirmed">
        <StatusMessage>Your email address is confirmed. You're signed in.</StatusMessage>
        <Link to={next} className="btn btn-primary btn-block">
          Continue to Caretook
        </Link>
      </AuthCard>
    );
  }

  const sentTo = actionData && "sentTo" in actionData ? actionData.sentTo : undefined;
  const error = actionData && "error" in actionData ? actionData.error : failure;

  return (
    <AuthCard title="Confirm your email">
      {state === "expired" ? (
        <ErrorMessage>{authMessages.verifyExpired}</ErrorMessage>
      ) : (
        <p className="text-sm">
          Before you can use Caretook, confirm your email address. We've sent a link to{" "}
          {email ? <strong>{email}</strong> : "your email"}: open it on this device.
        </p>
      )}
      {sentTo && <StatusMessage>{authMessages.verifySent(sentTo)}</StatusMessage>}
      <Form method="post" onSubmit={submitOnce} className="space-y-1">
        <input type="hidden" name="next" value={next} />
        {email ? <input type="hidden" name="email" value={email} /> : <EmailField defaultValue={sentTo} />}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
          {busy ? "Sending…" : "Send a new link"}
        </button>
      </Form>
      <p className="text-center text-sm">
        <Link to={accountUrls.signIn("password", next)} className="link">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
