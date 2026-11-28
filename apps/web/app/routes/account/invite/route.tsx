import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { InvitePreview, UsablePreview } from "./invitePage";
import type { Route } from "./+types/route";

import { ATTESTATION_TEXT, CONSENT_TEXT, SHARED_WITH_MEMBERS } from "@caretook/data/schema";
import { ORPCError } from "@orpc/client";
import { Form, Link, redirect, useNavigation } from "react-router";
import { Button, CheckField, Field, LINK } from "~/components/ui/plain";
import { accountUrls } from "~/lib/auth/accountUrls";
import { appUrls } from "~/lib/app-shell/appUrls";
import { authClient } from "~/lib/auth/auth-client";
import { sessionChanged } from "~/lib/auth/sessionEpoch";
import { authMessages, newPasswordProblem, requestFailure } from "~/lib/auth/authMessages";
import { formString } from "~/lib/core/form";
import { rpc } from "~/lib/core/rpc";
import { requireSession } from "~/lib/auth/session";
import { waitForMembership } from "~/lib/care-groups/members.sync";
import { AuthCard, ErrorMessage, StatusMessage, useSubmitOnce } from "../AuthCard";
import { LegalAgreement } from "../LegalAgreement";
import {
  invitedLine,
  inviteTitle,
  inviteView,
  isLink,
  joinLabel,
  LINK_APPROVAL_NOTE,
  roleMeaning,
} from "./invitePage";
import { LEGAL_REQUIRED_MESSAGE } from "@caretook/data/domain";

// `/invite/:token`: the page an email invite or an invite link opens. Shared
// by web + native, client-only: it reads the public `invite.preview`, and
// every step is an API call (online only). Signed out, it creates an account
// (with the invite's address, for an email invite; a link's account confirms
// its address by email first) or offers sign-in; signed in with that
// address, it shows what the group shares and asks for agreement before
// joining (an email invite) or asking to join (a link, which an owner or
// admin approves), with the legal box only for an account that hasn't agreed
// to the current versions (sign-up always has it); signed in as someone else than an email invite's
// address, it says so and offers to sign out. An invite that can't be used
// says why without naming the group.

// Never leaves the person's own device: the token is in the URL.
export const meta = () => [{ title: "Invitation · Caretook" }, { name: "robots", content: "noindex" }];

const isNetworkError = (e: unknown) => e instanceof TypeError;

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { token } = params;
  const [preview, user] = await Promise.all([
    rpc.invite.preview({ token }).then(
      (found) => found as InvitePreview,
      (e: unknown) => {
        if (isNetworkError(e)) return null;
        // A token that isn't even token-shaped.
        if (e instanceof ORPCError && e.code === "BAD_REQUEST") return { state: "notFound" } as const;
        throw e;
      },
    ),
    authClient.getSession().then(
      ({ data }) => (data ? { email: data.user.email, name: data.user.name } : null),
      () => null,
    ),
  ]);
  // If this read fails the box stays hidden: the server still refuses the
  // accept with `legalRequired`, and the form then shows it.
  const legalNeeded =
    user && preview?.state === "usable"
      ? await rpc.invite.legalNeeded().then(
          ({ needed }) => needed,
          () => false,
        )
      : false;
  return { token, preview, user, legalNeeded };
}

type ActionData = { intent: string; error?: string; legalIssue?: string; declined?: boolean };

const isLegalRequired = (e: unknown) =>
  e instanceof ORPCError &&
  (e.data as { code?: string } | undefined)?.code === "careGroupInviteService:legalRequired";

/** What a refused API call says: our messages are written for people. */
const apiFailure = (e: unknown): string => {
  if (isNetworkError(e)) return authMessages.offline;
  if (e instanceof ORPCError) {
    if (e.code === "TOO_MANY_REQUESTS") return authMessages.tooManyTries;
    if (e.code === "BAD_REQUEST" && !(e.data as { code?: string } | undefined)?.code)
      return "Check the form and try again.";
    return e.message || authMessages.failed;
  }
  throw e;
};

export async function clientAction({ request, params }: Route.ClientActionArgs): Promise<ActionData> {
  const { token } = params;
  const form = await request.formData();
  const intent = formString(form, "intent");

  if (intent === "decline") {
    try {
      await rpc.invite.decline({ token });
      return { intent, declined: true };
    } catch (e) {
      return { intent, error: apiFailure(e) };
    }
  }

  if (intent === "signUp") {
    const email = formString(form, "email").trim();
    const password = formString(form, "password");
    const problem = newPasswordProblem(password, formString(form, "confirm"));
    if (problem) return { intent, error: problem };
    if (form.get("legal") !== "on") return { intent, legalIssue: LEGAL_REQUIRED_MESSAGE };
    let created: { verified: boolean };
    try {
      created = await rpc.invite.signUp({
        token,
        name: formString(form, "name").trim(),
        email,
        password,
        legal: true,
      });
    } catch (e) {
      return { intent, error: apiFailure(e) };
    }
    if (!created.verified) {
      // A link's account confirms its address first: the emailed link signs
      // them in and brings them back here to ask to join. (An address that
      // already had an account gets the same page, and no new account.)
      const here = accountUrls.invite(token);
      await authClient.sendVerificationEmail({ email, callbackURL: here }).catch(() => undefined);
      throw redirect(accountUrls.verifyEmail(email, here));
    }
    // An email invite's account is verified already, so this signs straight in.
    const { error } = await authClient.signIn.email({ email, password });
    if (error) return { intent, error: requestFailure(error) ?? authMessages.failed };
    sessionChanged();
    // A new URL, not the same one: password managers read that as a sign-up
    // that worked, and offer to save the password (B-666).
    throw redirect(accountUrls.inviteSignedUp(token));
  }

  if (intent === "accept") {
    if (formString(form, "consent") !== "on") return { intent, error: "Tick the box to agree first." };
    let joined: { groupId: string; status: "joined" | "requested" };
    try {
      joined = await rpc.invite.accept({
        token,
        consent: true,
        ...(form.get("legal") === "on" ? { legal: true as const } : {}),
      });
    } catch (e) {
      if (e instanceof ORPCError && e.code === "UNAUTHORIZED")
        throw redirect(accountUrls.signIn("password", accountUrls.invite(token)));
      if (isLegalRequired(e)) return { intent, legalIssue: LEGAL_REQUIRED_MESSAGE };
      return { intent, error: apiFailure(e) };
    }
    // Asked to join (a link): home says it's waiting, and shows the group once approved.
    if (joined.status === "requested") throw redirect(appUrls.home());
    // Open the group once its membership has reached this device; until
    // then (a slow sync), the group list.
    const { user, db } = await requireSession(request);
    const here = await waitForMembership(db, { groupId: joined.groupId, userId: user.id });
    throw redirect(here ? appUrls.groupHome(joined.groupId) : appUrls.home());
  }

  return { intent, error: authMessages.failed };
}

// A refused step changed nothing to load again.
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const result = actionResult as ActionData | undefined;
  if (result?.error || result?.legalIssue) return false;
  return defaultShouldRevalidate;
}

export default function Invite({ loaderData, actionData }: Route.ComponentProps) {
  const { token, preview, user, legalNeeded } = loaderData;

  if (!preview) {
    return (
      <AuthCard title="Invitation">
        <ErrorMessage>{authMessages.offline}</ErrorMessage>
        <Button to={accountUrls.invite(token)} variant="primary" block>
          Try again
        </Button>
      </AuthCard>
    );
  }

  if (actionData?.declined) {
    return (
      <AuthCard title="Invitation declined">
        <StatusMessage>You declined the invitation. The person who sent it will see that.</StatusMessage>
      </AuthCard>
    );
  }

  const view = inviteView(preview, user);
  if (view.view === "closed") {
    return (
      <AuthCard title={view.title}>
        <p data-invite-state={preview.state} className="text-sm">
          {view.message}
        </p>
        <Button to={user ? appUrls.home() : accountUrls.signIn()} block>
          {user ? "Go to Caretook" : "Sign in"}
        </Button>
      </AuthCard>
    );
  }

  if (view.view === "wrongAccount") {
    return (
      <AuthCard title="This invitation is for another email address">
        <p className="text-sm">
          You're signed in as <strong>{view.signedInAs}</strong>, but the invitation was sent to a different
          address. Sign out, then sign in or create an account with the address it was sent to.
        </p>
        <SignOutButton token={token} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={inviteTitle(view.invite)}>
      <div className="space-y-1 text-sm">
        <p>{invitedLine(view.invite)}</p>
        <p className="text-muted">{roleMeaning(view.invite.role)}</p>
      </div>
      {view.view === "signUp" ? (
        <SignUpForm
          token={token}
          invite={view.invite}
          error={pick(actionData, "signUp")}
          legalIssue={pickLegal(actionData, "signUp")}
        />
      ) : (
        <ConsentForm
          invite={view.invite}
          error={pick(actionData, "accept")}
          legalNeeded={legalNeeded}
          legalIssue={pickLegal(actionData, "accept")}
        />
      )}
      {/* A link can't be declined: whoever has it just doesn't ask. */}
      {!isLink(view.invite) && <DeclineForm error={pick(actionData, "decline")} />}
    </AuthCard>
  );
}

const pick = (data: ActionData | undefined, intent: string) =>
  data?.intent === intent ? data.error : undefined;
const pickLegal = (data: ActionData | undefined, intent: string) =>
  data?.intent === intent ? data.legalIssue : undefined;

function LegalBox({ error }: { error?: string }) {
  return (
    <CheckField
      className="mt-3 text-sm"
      name="legal"
      required
      nativeRequired
      error={error}
      data-legal-box=""
      label={<LegalAgreement />}
    />
  );
}

function SignUpForm({
  token,
  invite,
  error,
  legalIssue,
}: {
  token: string;
  invite: UsablePreview;
  error?: string;
  legalIssue?: string;
}) {
  const submitOnce = useSubmitOnce();
  const busy = useNavigation().state !== "idle";
  return (
    <>
      <Form method="post" onSubmit={submitOnce} className="space-y-1" data-invite-form="signUp">
        <input type="hidden" name="intent" value="signUp" />
        {isLink(invite) ? (
          <Field kind="input" label="Email" required help="We'll email you a link to confirm it.">
            {(control) => (
              <input
                {...control}
                type="email"
                name="email"
                autoComplete="username"
                maxLength={254}
                required
              />
            )}
          </Field>
        ) : (
          <Field kind="input" label="Email" help="The invitation is for this address.">
            {(control) => (
              <input
                {...control}
                type="email"
                name="email"
                autoComplete="username"
                value={invite.email ?? ""}
                readOnly
                aria-readonly="true"
              />
            )}
          </Field>
        )}
        <Field kind="input" label="Your name" required>
          {(control) => <input {...control} name="name" autoComplete="name" maxLength={100} required />}
        </Field>
        <Field kind="input" label="Password" required help="At least 12 characters.">
          {(control) => (
            <input
              {...control}
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          )}
        </Field>
        <Field kind="input" label="Password again" required>
          {(control) => (
            <input {...control} type="password" name="confirm" autoComplete="new-password" required />
          )}
        </Field>
        <LegalBox error={legalIssue} />
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button
          type="submit"
          variant="primary"
          block
          className="mt-2"
          busy={busy}
          busyLabel="Creating your account…"
        >
          Create account
        </Button>
      </Form>
      <p className="text-center text-sm">
        Already have a Caretook account?{" "}
        <Link to={accountUrls.signIn("password", accountUrls.invite(token))} className={LINK}>
          Sign in
        </Link>
      </p>
    </>
  );
}

function ConsentForm({
  invite,
  error,
  legalNeeded,
  legalIssue,
}: {
  invite: UsablePreview;
  error?: string;
  legalNeeded: boolean;
  legalIssue?: string;
}) {
  const submitOnce = useSubmitOnce();
  const busy = useNavigation().state !== "idle";
  const group = invite.groupName ? `${invite.groupName}'s care group` : "This care group";
  return (
    <Form method="post" onSubmit={submitOnce} className="space-y-3" data-invite-form="accept">
      <input type="hidden" name="intent" value="accept" />
      <div className="text-sm">
        <p className="font-medium">{group} shares:</p>
        <ul className="list-disc ps-5">
          {SHARED_WITH_MEMBERS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {isLink(invite) ? (
        <p className="text-muted text-sm">{LINK_APPROVAL_NOTE}</p>
      ) : (
        <p className="text-muted text-sm">The person who invited you confirmed: “{ATTESTATION_TEXT}”</p>
      )}
      <CheckField className="text-sm" name="consent" required nativeRequired label={CONSENT_TEXT} />
      {(legalNeeded || legalIssue) && <LegalBox error={legalIssue} />}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" variant="primary" block busy={busy}>
        {joinLabel(invite, busy)}
      </Button>
    </Form>
  );
}

function DeclineForm({ error }: { error?: string }) {
  const submitOnce = useSubmitOnce();
  const busy = useNavigation().state !== "idle";
  return (
    <Form method="post" onSubmit={submitOnce} className="text-center" data-invite-form="decline">
      <input type="hidden" name="intent" value="decline" />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" variant="ghost" size="sm" busy={busy}>
        Decline invitation
      </Button>
    </Form>
  );
}

function SignOutButton({ token }: { token: string }) {
  const submitOnce = useSubmitOnce();
  const busy = useNavigation().state !== "idle";
  return (
    <Form method="post" action="/sign-out" onSubmit={submitOnce}>
      <input type="hidden" name="redirectTo" value={accountUrls.invite(token)} />
      <Button type="submit" variant="primary" block busy={busy} busyLabel="Signing out…">
        Sign out
      </Button>
    </Form>
  );
}
