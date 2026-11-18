import type { Route } from "./+types/sign-in";

import { Form, redirect, useNavigation } from "react-router";
import { authClient } from "~/lib/auth-client";
import { formString } from "~/lib/form";
import { safeRedirect } from "~/lib/redirect";

// Shared by web + native: client-only, like every /app route.

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in · Caretook" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const redirectTo = safeRedirect(new URL(request.url).searchParams.get("redirectTo"));
  const { data } = await authClient.getSession();
  if (data) throw redirect(redirectTo);
  return { redirectTo };
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const { error } = await authClient.signIn.email({
    email: formString(form, "email"),
    password: formString(form, "password"),
  });
  // One message for every failure: don't reveal which emails have accounts.
  if (error) return { error: "That email and password don't match an account." };
  throw redirect(safeRedirect(formString(form, "redirectTo")));
}

export default function SignIn({ loaderData, actionData }: Route.ComponentProps) {
  // Busy from submit until the navigation it starts is idle: a successful sign-in
  // redirects, and the state is "loading" while /app's loaders run (up to the first
  // sync), so checking only "submitting" would re-enable the button for a second
  // sign-in. An error returns to idle, which re-enables the form.
  const busy = useNavigation().state !== "idle";
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="card bg-base-100 w-full max-w-sm shadow-md">
        <div className="card-body">
          <h1 className="card-title text-2xl">Sign in to Caretook</h1>
          <Form method="post" className="space-y-1">
            <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
            <fieldset className="fieldset">
              <label className="fieldset-legend" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input w-full"
                type="email"
                name="email"
                autoComplete="email"
                required
              />
            </fieldset>
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
            {actionData?.error && (
              <p role="alert" className="text-error text-sm">
                {actionData.error}
              </p>
            )}
            <button type="submit" className="btn btn-primary btn-block mt-2" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </Form>
        </div>
      </div>
    </main>
  );
}
