import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { CodePreview, JoinStep } from "./joinPage";
import type { Route } from "./+types/route";

import { newCareGroupZSchema } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { useRef, useState } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { NewGroupFields, newGroupFromForm } from "~/components/groups";
import { Field } from "~/components/ui";
import { toActionResult } from "~/lib/api";
import { accountUrls } from "~/lib/accountUrls";
import { appUrls } from "~/lib/appUrls";
import { authClient } from "~/lib/auth-client";
import { authMessages, newPasswordProblem } from "~/lib/authMessages";
import { formString } from "~/lib/form";
import { rpc } from "~/lib/rpc";
import { NEW_GROUP_LINK_STATE } from "../../app/groups/new/newGroupLink";
import { AuthCard, ErrorMessage, useSubmitOnce } from "../AuthCard";
import { CLOSED_CODE, stepForIssues } from "./joinPage";

// `/join/:code`: a staff access code's link (printed as a QR code). Shared by
// web + native, client-only. Signed out, it's a two-step form: your account
// (name, email, password), then who you care for. One API call creates the
// account and the care group, with you as its owner, then a confirmation
// email goes out: once the address is confirmed, /app opens the new group's
// timeline. An address that already has an account sees the same "check your
// email" and gets an email saying to sign in instead. Signed in, it points at
// New care group instead. A code that can't be used says why, plainly.

export const meta = () => [
  { title: "Start a care group · Caretook" },
  { name: "robots", content: "noindex" },
];

const isNetworkError = (e: unknown) => e instanceof TypeError;

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const [preview, user] = await Promise.all([
    rpc.accessCode.preview({ code: params.code }).then(
      (found) => found as CodePreview,
      (e: unknown) => {
        if (isNetworkError(e)) return null;
        if (e instanceof ORPCError && e.code === "BAD_REQUEST") return { state: "notFound" } as const;
        throw e;
      },
    ),
    authClient.getSession().then(
      ({ data }) => (data ? { email: data.user.email } : null),
      () => null,
    ),
  ]);
  return { code: params.code, preview, user };
}

type ActionData = { error: string; issues: { path: string; message: string }[] };

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionData> {
  const form = await request.formData();
  const email = formString(form, "email").trim();
  const password = formString(form, "password");
  const problem = newPasswordProblem(password, formString(form, "confirm"));
  if (problem) return { error: problem, issues: [{ path: "password", message: problem }] };
  const group = newCareGroupZSchema.safeParse(newGroupFromForm(form));
  if (!group.success) {
    return {
      error: "",
      issues: group.error.issues.map((i) => ({ path: `group.${i.path.join(".")}`, message: i.message })),
    };
  }
  try {
    await rpc.accessCode.signUp({
      code: params.code,
      name: formString(form, "name").trim(),
      email,
      password,
      group: group.data,
    });
  } catch (e) {
    if (isNetworkError(e)) return { error: authMessages.offline, issues: [] };
    if (e instanceof ORPCError && e.code === "TOO_MANY_REQUESTS")
      return { error: authMessages.tooManyTries, issues: [] };
    const result = toActionResult(e);
    if (result.ok) throw e;
    return {
      error: result.issues.length ? "Check the form and try again." : result.error,
      issues: result.issues,
    };
  }
  // Confirm the address, then open Caretook, which goes straight to the new
  // group (the only one). An address that already has an account lands here
  // too, and gets an email saying to sign in (B-67): the answer doesn't say
  // which it was.
  const next = appUrls.home();
  await authClient.sendVerificationEmail({ email, callbackURL: next }).catch(() => undefined);
  throw redirect(accountUrls.verifyEmail(email, next));
}

// A refused sign-up changed nothing: keep the form as it is.
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return actionResult ? false : defaultShouldRevalidate;
}

export default function Join({ loaderData, actionData }: Route.ComponentProps) {
  const { code, preview, user } = loaderData;

  if (!preview) {
    return (
      <AuthCard title="Start a care group">
        <ErrorMessage>{authMessages.offline}</ErrorMessage>
        <Link to={accountUrls.join(code)} className="btn btn-primary btn-block">
          Try again
        </Link>
      </AuthCard>
    );
  }

  if (preview.state !== "usable") {
    const closed = CLOSED_CODE[preview.state];
    return (
      <AuthCard title={closed.title}>
        <p data-code-state={preview.state} className="text-sm">
          {closed.message}
        </p>
        <Link to={user ? appUrls.home() : accountUrls.signIn()} className="btn btn-block">
          {user ? "Go to Caretook" : "Sign in"}
        </Link>
      </AuthCard>
    );
  }

  if (user) {
    return (
      <AuthCard title="You already have an account">
        <p className="text-sm">
          You're signed in as <strong>{user.email}</strong>. You don't need a code to start another care
          group.
        </p>
        <Link to={appUrls.newGroup()} state={NEW_GROUP_LINK_STATE} className="btn btn-primary btn-block">
          New care group
        </Link>
        <Link to={appUrls.home()} className="btn btn-ghost btn-block">
          Go to Caretook
        </Link>
      </AuthCard>
    );
  }

  return <JoinForm key={code} actionData={actionData} />;
}

const INPUT = "input w-full";

function JoinForm({ actionData }: { actionData: ActionData | undefined }) {
  const submitOnce = useSubmitOnce();
  const busy = useNavigation().state !== "idle";
  const [step, setStep] = useState<JoinStep>("account");
  const accountRef = useRef<HTMLDivElement>(null);
  // A refusal opens the step it's about (once per result).
  const [shown, setShown] = useState<ActionData | undefined>(undefined);
  if (actionData && actionData !== shown) {
    setShown(actionData);
    setStep(stepForIssues(actionData.issues.map((i) => i.path)));
  }
  const issue = (path: string) => actionData?.issues.find((i) => i.path === path)?.message;
  const groupIssues = (actionData?.issues ?? [])
    .filter((i) => i.path.startsWith("group."))
    .map((i) => ({ ...i, path: i.path.slice("group.".length) }));

  const next = () => {
    const fields = accountRef.current?.querySelectorAll("input") ?? [];
    for (const input of fields) if (!input.reportValidity()) return;
    setStep("recipient");
  };

  return (
    <AuthCard title={step === "account" ? "Start a care group" : "Who do you care for?"}>
      <Form method="post" onSubmit={submitOnce} className="space-y-1" data-join-form={step}>
        <div ref={accountRef} hidden={step !== "account"} data-join-step="account">
          <p className="text-sm">First, your Caretook account. You'll be the care group's owner.</p>
          <Field label="Your name">
            {(control) => (
              <input
                {...control}
                className={INPUT}
                name="name"
                autoComplete="name"
                maxLength={100}
                required
              />
            )}
          </Field>
          <Field label="Email" error={issue("email")}>
            {(control) => (
              <input {...control} className={INPUT} type="email" name="email" autoComplete="email" required />
            )}
          </Field>
          <Field label="Password" help="At least 12 characters." error={issue("password")}>
            {(control) => (
              <input
                {...control}
                className={INPUT}
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            )}
          </Field>
          <Field label="Password again">
            {(control) => (
              <input
                {...control}
                className={INPUT}
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
              />
            )}
          </Field>
        </div>
        <div hidden={step !== "recipient"} data-join-step="recipient">
          <NewGroupFields issues={groupIssues} />
        </div>
        {actionData?.error && <ErrorMessage>{actionData.error}</ErrorMessage>}
        {step === "account" ? (
          <button type="button" className="btn btn-primary btn-block mt-2" onClick={next}>
            Continue
          </button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn" onClick={() => setStep("account")} disabled={busy}>
              Back
            </button>
            <button type="submit" className="btn btn-primary grow" disabled={busy}>
              {busy ? "Creating…" : "Create care group"}
            </button>
          </div>
        )}
      </Form>
      <p className="text-center text-sm">
        Already have a Caretook account?{" "}
        <Link to={accountUrls.signIn()} className="link">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
