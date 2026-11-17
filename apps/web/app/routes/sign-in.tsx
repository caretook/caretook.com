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
  const submitting = useNavigation().state === "submitting";
  return (
    <main>
      <h1>Sign in</h1>
      <Form method="post">
        <input type="hidden" name="redirectTo" value={loaderData.redirectTo} />
        <p>
          <label>
            Email <input type="email" name="email" autoComplete="email" required />
          </label>
        </p>
        <p>
          <label>
            Password <input type="password" name="password" autoComplete="current-password" required />
          </label>
        </p>
        {actionData?.error && <p role="alert">{actionData.error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </Form>
    </main>
  );
}
