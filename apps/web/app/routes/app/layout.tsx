import type { Route } from "./+types/layout";

import { Form, isRouteErrorResponse, Link, Outlet, redirect } from "react-router";
import { authClient } from "~/lib/auth-client";
import { signInUrl } from "~/lib/redirect";

// Shared by web + native. Do not export a server `loader` or `action` from /app routes.

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { data } = await authClient.getSession();
  if (!data) throw redirect(signInUrl(request));
  return { user: data.user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <>
      <header className="navbar bg-base-100 px-4 shadow-sm">
        <div className="flex-1">
          <Link to="/app" className="text-lg font-semibold">
            Caretook
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base-content/70 hidden text-sm sm:inline">{user.name ?? user.email}</span>
          <Link to="/app/settings" className="btn btn-ghost btn-sm">
            Settings
          </Link>
          <Form method="post" action="/sign-out">
            <button type="submit" className="btn btn-ghost btn-sm">
              Sign out
            </button>
          </Form>
        </div>
      </header>
      <Outlet />
    </>
  );
}

// Errors inside /app (a missing group, a failed load) render here, so the
// page keeps its frame and a way back.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  if (!notFound) console.error(error);
  return (
    <main className="mx-auto max-w-xl space-y-3 px-4 py-10">
      <h1 className="text-2xl font-semibold">{notFound ? "Not found" : "Something went wrong"}</h1>
      <p className="text-base-content/70">
        {notFound ? "This page doesn't exist, or you don't have access to it." : "Try again in a moment."}
      </p>
      <Link to="/app" className="btn btn-primary">
        Back to Caretook
      </Link>
    </main>
  );
}
