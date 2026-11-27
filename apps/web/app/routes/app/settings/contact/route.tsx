import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";

import { SettingsCard, SettingsPage } from "~/components/settings";
import { load, toActionResult } from "~/lib/core/api";
import { contactFromForm, issuesForRows } from "~/lib/core/contactForm";
import { rpc } from "~/lib/core/rpc";
import { sessionContext } from "~/lib/auth/session";
import { ContactForm } from "./ContactForm";

// `/app/settings/contact` (profiles): your phones, a contact email and an
// address, entered once. Each care group sees only what you choose on its
// Members page. Shared by web + native. They aren't synced (only what you
// share is), so the page reads and saves through the API: online only.

export const meta = () => [{ title: "Contact details · Settings · Caretook" }];

const OFFLINE_CONTACT = "Needs a connection to show and edit your contact details.";

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  try {
    const contact = await load(request, rpc.me.contact());
    return { online: true as const, contact, signInEmail: user.email };
  } catch (e) {
    // fetch fails with a TypeError when there's no connection.
    if (e instanceof TypeError) return { online: false as const, contact: null, signInEmail: user.email };
    throw e;
  }
}

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionResult> {
  const { input, phoneRows } = contactFromForm(await request.formData());
  try {
    await rpc.me.updateContact(input);
    return { ok: true };
  } catch (e) {
    if (e instanceof TypeError) return { ok: false, error: OFFLINE_CONTACT, issues: [] };
    const result = toActionResult(e);
    if (result.ok || !result.issues.length) return result;
    return {
      ...result,
      error: "Check the highlighted fields.",
      issues: issuesForRows(result.issues, phoneRows),
    };
  }
}

export default function ContactSettings({ loaderData }: Route.ComponentProps) {
  const { online, contact, signInEmail } = loaderData;
  return (
    <SettingsPage id="contact" title="Contact details" offlineNotice={online ? undefined : OFFLINE_CONTACT}>
      <SettingsCard>
        <p className="text-muted text-sm">
          Each care group sees only what you choose on its Members page. Nothing is shared until you do.
        </p>
        {contact && <ContactForm contact={contact} signInEmail={signInEmail} />}
      </SettingsCard>
    </SettingsPage>
  );
}
