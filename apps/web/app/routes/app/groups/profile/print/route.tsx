import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { Printer } from "lucide-react";
import { Navigate, redirect } from "react-router";
import { canReadRecipient } from "@caretook/data/schema";
import { BackLink, Button } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup, useGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { EmergencySheet } from "./EmergencySheet";
import { loadEmergencySheetRows, useEmergencySheet } from "./useEmergencySheet";

// Shared by web + native. `…/profile/print`: the printable emergency sheet
// (profiles slice 6), for writers (owners, admins, caretakers: the members
// whose devices have the recipient's details). Anyone else lands on the
// profile. Read from the device's local copy (live), so it opens and prints
// offline. Like the medication sheet, it sits in the /app frame on screen;
// the print CSS (`print:hidden` on the frame, `@media print` in app.css)
// leaves just the sheet, black on white. Printing is the browser's.

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: loaderData?.title
        ? `${loaderData.title} · Emergency sheet · Caretook`
        : "Emergency sheet · Caretook",
    },
  ];
}

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  const group = getGroup(context);
  if (!canReadRecipient(group.role, "details")) throw redirect(appUrls.profile(group.id));
  const { db } = context.get(sessionContext);
  const rows = await loadEmergencySheetRows(db, params.groupId);
  return { ...rows, title: group.recipient?.displayName ?? group.displayName };
}

/** Live queries keep the sheet current, so nothing reruns the loader but another group. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function EmergencySheetPage({ loaderData, params }: Route.ComponentProps) {
  const group = useGroup();
  const sheet = useEmergencySheet(params.groupId, loaderData);
  // A member demoted to viewer while it's open: their device loses the details, and the sheet goes.
  if (!canReadRecipient(group.role, "details")) return <Navigate to={appUrls.profile(group.id)} replace />;

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 print:max-w-none print:p-0" data-print-page="">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackLink to={appUrls.profile(params.groupId)} label="Profile" />
        <Button variant="primary" size="sm" icon={Printer} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <EmergencySheet sheet={sheet} />
    </main>
  );
}
