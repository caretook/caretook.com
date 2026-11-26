import type { Route } from "./+types/route";

import { ExternalLink, LogOut } from "lucide-react";
import { Form } from "react-router";
import { SettingsCard, SettingsPage } from "~/components/settings";
import { Button } from "~/components/ui";
import { legalLinks } from "~/lib/auth/legalLinks";
import { sessionContext } from "~/lib/auth/session";
import { AvatarCard } from "./AvatarCard";

// `/app/settings/account`: who's signed in (read-only for now), and Sign out
// (POST to /sign-out, as the account menu does). Shared by web + native.

export const meta = () => [{ title: "Account · Settings · Caretook" }];

export function clientLoader({ context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  return { userId: user.id, name: user.name, email: user.email };
}

export default function AccountSettings({ loaderData }: Route.ComponentProps) {
  const { userId, name, email } = loaderData;
  return (
    <SettingsPage title="Account">
      <AvatarCard userId={userId} name={name} email={email} />
      <SettingsCard>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-muted">Name</dt>
          <dd data-field="name">{name || "Not set"}</dd>
          <dt className="text-muted">Email</dt>
          <dd data-field="email" className="break-all">
            {email}
          </dd>
        </dl>
        <Form method="post" action="/sign-out" className="pt-2">
          <Button type="submit" icon={LogOut}>
            Sign out
          </Button>
        </Form>
      </SettingsCard>
      <SettingsCard id="legal" title="Legal">
        <ul className="space-y-2">
          {legalLinks(import.meta.env.VITE_API_ORIGIN).map(({ label, href }) => (
            <li key={href}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="link link-primary inline-flex items-center gap-1"
              >
                {label}
                <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </SettingsPage>
  );
}
