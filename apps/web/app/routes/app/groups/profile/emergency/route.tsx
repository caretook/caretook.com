import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import type { ActionResult } from "~/lib/core/api";

import { Sheet } from "~/components/ui";
import { EmergencyForm } from "../EmergencyForm";
import { loadEmergencySheet, saveEmergencySheet } from "../emergencySheet";
import { useCloseProfileSheet } from "../profileSheet";

// Shared by web + native. `…/profile/emergency`: the sheet over the profile
// where owners and admins build the emergency list: members who share a
// phone, outside contacts (name, relationship, phone), the order, and the
// primary contact. It starts from the device's copy and saves online.
// Anyone else lands on the profile.

export const clientLoader = ({ params, context }: Route.ClientLoaderArgs) =>
  loadEmergencySheet(context, params.groupId);

export async function clientAction({
  request,
  params,
  context,
}: Route.ClientActionArgs): Promise<ActionResult> {
  return saveEmergencySheet(context, params.groupId, await request.formData());
}

/** The sheet closes on a save; nothing to load again. */
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  if (formMethod) return false;
  return defaultShouldRevalidate;
}

export default function EmergencySheet({ loaderData, params }: Route.ComponentProps) {
  const close = useCloseProfileSheet(params.groupId);
  return (
    <Sheet guardChanges isOpen onOpenChange={(open) => !open && close()} title="Emergency contacts">
      <EmergencyForm
        members={loaderData.members}
        outside={loaderData.outside}
        onDone={close}
        onCancel={close}
      />
    </Sheet>
  );
}
