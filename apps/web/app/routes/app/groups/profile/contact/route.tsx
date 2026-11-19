import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/api";

import { Sheet } from "~/components/ui";
import { issuesForRows, phonesFromForm } from "~/lib/contactForm";
import { parseRecipientContact } from "../detailsFormData";
import { loadDetailsSheet, saveDetails } from "../detailsSheet";
import { useCloseProfileSheet } from "../profileSheet";
import { RecipientContactForm } from "../RecipientContactForm";

// Shared by web + native. `…/profile/contact`: the sheet over the profile
// where writers (owners, admins, caretakers) edit the recipient's phones,
// email and address. It starts from the device's copy and saves online
// through `careGroup.updateRecipientDetails`. Anyone else lands on the profile.

export const clientLoader = ({ params, context }: Route.ClientLoaderArgs) =>
  loadDetailsSheet(context, params.groupId);

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const parsed = parseRecipientContact(form);
  if (!parsed.ok) return parsed;
  const { phoneRows } = phonesFromForm(form);
  return saveDetails(context, params.groupId, parsed.data, (issues) => issuesForRows(issues, phoneRows));
}

/** The sheet closes on a save; nothing to load again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function ContactSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  return (
    <Sheet isOpen onOpenChange={(open) => !open && close()} title="Edit contact">
      <RecipientContactForm details={loaderData.details} onDone={close} onCancel={close} />
    </Sheet>
  );
}
