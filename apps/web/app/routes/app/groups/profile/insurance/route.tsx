import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { Sheet } from "~/components/ui";
import { issuesForPlanRows, parseInsuranceForm, plansFromForm } from "../detailsFormData";
import { loadDetailsSheet, saveDetails } from "../detailsSheet";
import { InsuranceForm } from "../InsuranceForm";
import { useCloseProfileSheet } from "../profileSheet";

// Shared by web + native. `…/profile/insurance`: the sheet over the profile
// where writers (owners, admins, caretakers) add, edit and remove the
// recipient's insurance plans. It starts from the device's copy and saves
// every plan online through `careGroup.updateRecipientDetails`. Anyone else
// lands on the profile.

export const clientLoader = ({ params, context }: Route.ClientLoaderArgs) =>
  loadDetailsSheet(context, params.groupId);

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const parsed = parseInsuranceForm(form);
  if (!parsed.ok) return parsed;
  const { keys } = plansFromForm(form);
  return saveDetails(context, params.groupId, { insurance: parsed.data }, (issues) =>
    issuesForPlanRows(issues, keys),
  );
}

/** The sheet closes on a save; nothing to load again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function InsuranceSheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Edit insurance">
      <InsuranceForm plans={loaderData.details.insurance} onDone={close} onCancel={close} />
    </Sheet>
  );
}
