import type { Route } from "./+types/route";

import { LogOut } from "lucide-react";
import { Form } from "react-router";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { sessionContext } from "~/lib/auth/session";

// `/app/settings/account`: who's signed in (read-only for now), and Sign out
// (POST to /sign-out, as the account menu does). Shared by web + native.

export const meta = () => [{ title: "Account · Settings · Caretook" }];

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  return { name: user.name, email: user.email };
}

export default function AccountSettings({ loaderData }: Route.ComponentProps) {
  const { name, email } = loaderData;
  return (
    <SettingsPage title="Account">
      <SettingsCard>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-base-content/70">Name</dt>
          <dd data-field="name">{name || "Not set"}</dd>
          <dt className="text-base-content/70">Email</dt>
          <dd data-field="email" className="break-all">
            {email}
          </dd>
        </dl>
        <Form method="post" action="/sign-out" className="pt-2">
          <button type="submit" className="btn gap-2">
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </Form>
      </SettingsCard>
    </SettingsPage>
  );
}
