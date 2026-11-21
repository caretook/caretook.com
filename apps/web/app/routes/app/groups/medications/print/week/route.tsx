import type { Route } from "./+types/route";
import type { ShouldRevalidateFunctionArgs } from "react-router";

import { Printer } from "lucide-react";
import { useSearchParams } from "react-router";
import { PrintAllergies, PrintConditions } from "~/components/medications";
import { BackLink } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";
import { getGroup } from "~/lib/app-shell/group";
import { sessionContext } from "~/lib/auth/session";
import { loadAllergies, useAllergies } from "~/lib/medications/allergies.sync";
import { loadConditions, useConditions } from "~/lib/profiles/conditions.sync";
import { loadWeeklyData } from "./loadWeeklyData";
import { useWeeklySheet } from "./useWeeklySheet";
import { WeekPicker } from "./WeekPicker";
import { WEEK_START_PARAM } from "./weeklySheet";
import { WeeklyChart } from "./WeeklyChart";

// Shared by web + native. The weekly bedside sheet: a week's chart with a box
// per pass, medication and day, and the recipient's allergies at the top,
// read from the device's local copy (live), so it prints offline. The week
// starts on `?start=` (this week's Monday in the recipient's zone without
// one). Print CSS leaves just the sheet, black on white, on a landscape page
// (`@page weekly` in app.css).

export const meta = () => [{ title: "Medication chart · Caretook" }];

export async function clientLoader({ params, context }: Route.ClientLoaderArgs) {
  getGroup(context);
  const { db } = context.get(sessionContext);
  const [data, allergies, conditions] = await Promise.all([
    loadWeeklyData(db, params.groupId),
    loadAllergies(db, params.groupId),
    loadConditions(db, params.groupId),
  ]);
  return { ...data, allergies, conditions };
}

/** Live queries keep the sheet current, and the week is read from the URL: nothing reruns the loader but another group. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
}

export default function MedicationsPrintWeek({ loaderData, params }: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const sheet = useWeeklySheet(params.groupId, searchParams.get(WEEK_START_PARAM), loaderData);
  const { state: allergies } = useAllergies(params.groupId, loaderData.allergies);
  const { state: conditions } = useConditions(params.groupId, loaderData.conditions);

  return (
    <main
      className="mx-auto max-w-5xl space-y-4 px-4 py-5 [page:weekly] print:max-w-none print:p-0"
      data-print-page
    >
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <BackLink to={appUrls.medications(params.groupId)} label="Medications" />
        <button type="button" className="btn btn-primary btn-sm gap-1.5" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </button>
      </div>
      <WeekPicker groupId={params.groupId} sheet={sheet} />
      <WeeklyChart
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
