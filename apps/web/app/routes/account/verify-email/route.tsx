import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { Route } from "./+types/route";

import { Form, Link, useNavigation } from "react-router";
import { Button } from "~/components/ui/plain";
import { accountUrls } from "~/lib/auth/accountUrls";
import { authClient } from "~/lib/auth/auth-client";
import { authMessages, requestFailure, unreached } from "~/lib/auth/authMessages";
import { formString } from "~/lib/core/form";
import { safeRedirect } from "~/lib/core/redirect";
import { AuthCard, useSubmitOnce, EmailField, ErrorMessage, StatusMessage } from "../AuthCard";

// Shared by web + native: client-only. Two ways in:
// - from the emailed link (`?token=`): the token is checked at once, which
//   confirms the address and signs the user in;
// - from sign-in, when the password was right but the address isn't
//   confirmed yet (`?email=`): Better Auth has just sent a link, and the
//   page offers to send another.
// An unverified account never reaches /app: Better Auth refuses its
// password sign-in, and lib/auth/session.ts sends any such session here.

export function meta({}: Route.MetaArgs) {
  return [{ title: "Confirm your email · Caretook" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const next = safeRedirect(params.get("next"));
  const token = params.get("token");
  if (token) {
    const { error } = await authClient.verifyEmail({ query: { token } }).catch(unreached);
    // Offline or rate-limited, the link wasn't checked: say that, not that it expired.
    const failure = requestFailure(error);
    if (failure) return { state: "unchecked" as const, next, email: "", failure };
    if (error) return { state: "expired" as const, next, email: "", failure: null };
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
  const { error } = await authClient
    .sendVerificationEmail({
      email,
      callbackURL: safeRedirect(formString(form, "next")),
    })
    .catch(unreached);
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
        <Button to={next} variant="primary" block>
          Continue to Caretook
        </Button>
      </AuthCard>
    );
  }

  const sentTo = actionData && "sentTo" in actionData ? actionData.sentTo : undefined;
  const error = actionData && "error" in actionData ? actionData.error : failure;

  return (
    <AuthCard title="Confirm your email">
      {state === "expired" ? (
        <ErrorMessage>{authMessages.verifyExpired}</ErrorMessage>
      ) : state === "unchecked" ? null : (
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
        <Button type="submit" variant="primary" block className="mt-2" busy={busy} busyLabel="Sending…">
          Send a new link
        </Button>
      </Form>
      <p className="text-center text-sm">
        <Link to={accountUrls.signIn("password", next)} className="link">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
