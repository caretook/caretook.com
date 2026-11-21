import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { Printer } from "lucide-react";
import { PrintAllergies, PrintConditions } from "~/components/medications";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { loadConditions, useConditions } from "~/lib/profiles/conditions.sync";
import { loadPrintData } from "./loadPrintData";
import { MedicationSheet } from "./MedicationSheet";
import { usePrintSheet } from "./usePrintSheet";

// Shared by web + native. The printable medication sheet: the recipient,
// their current medications, those stopped in the last 90 days, and who to
// call, with the recipient's allergies at the top. Read from the device's local copy (live), so it prints offline.
// On screen it sits in the /app frame; print CSS (`print:hidden` on the
// frame, the `@media print` block in app.css) leaves just the sheet, black
// on white. Printing is the browser's (Print, or Save as PDF).

export const meta = () => [{ title: "Medication list · Caretook" }];

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [data, allergies, conditions] = await Promise.all([
    loadPrintData(db, params.groupId),
    loadAllergies(db, params.groupId),
    loadConditions(db, params.groupId),
  ]);
  return { ...data, allergies, conditions };
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

export default function MedicationsPrint({ loaderData, params }: Route.ComponentProps) {
  const sheet = usePrintSheet(params.groupId, loaderData);
  const { state: allergies } = useAllergies(params.groupId, loaderData.allergies);
  const { state: conditions } = useConditions(params.groupId, loaderData.conditions);

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-5 print:max-w-none print:p-0" data-print-page>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackLink to={appUrls.medications(params.groupId)} label="Medications" />
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </button>
      </div>
      <MedicationSheet
        sheet={sheet}
        allergies={
          <>
            <PrintAllergies state={allergies} />
            <PrintConditions state={conditions} />
          </>
        }
      />
    </main>
  );
}
