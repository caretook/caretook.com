import type { Route } from "./+types/layout";

import { Form, Outlet, redirect } from "react-router";
import { authClient } from "~/lib/auth-client";
import { signInUrl } from "~/lib/redirect";

// Shared by web + native. Do not export a server `loader` or `action` from /app routes.

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { data } = await authClient.getSession();
  if (!data) throw redirect(signInUrl(request));
  return { user: data.user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <header>
        <span>{loaderData.user.name ?? loaderData.user.email}</span>
        <Form method="post" action="/sign-out">
          <button type="submit">Sign out</button>
        </Form>
      </header>
      <Outlet />
    </>
  );
}
