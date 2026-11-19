import type { Measure } from "@caretook/data/schema";
import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/api";

import { UNIT_LABEL, UNIT_OPTIONS, unitChoicesZSchema } from "@caretook/data/schema";
import { useFetcher } from "react-router";
import { SaveRow, SettingsCard, SettingsPage } from "~/components/settings";
import { ChoiceGroup } from "~/components/ui";
import { toActionResult } from "~/lib/api";
import { formString } from "~/lib/form";
import { loadSettings } from "~/lib/me";
import { rpc } from "~/lib/rpc";
import { sessionContext } from "~/lib/session";

// `/app/settings/units`. Shared by web + native: client-only data
// (clientLoader/clientAction over oRPC). Units save online only.

export const meta = () => [{ title: "Units · Settings · Caretook" }];

export async function clientLoader({ request, context }: Route.ClientLoaderArgs) {
  const { user } = context.get(sessionContext);
  const { units } = await loadSettings(request, user.id);
  return { units };
}

const MEASURES: { measure: Measure; label: string }[] = [
  { measure: "temperature", label: "Temperature" },
  { measure: "weight", label: "Weight" },
  { measure: "glucose", label: "Blood sugar" },
  { measure: "volume", label: "Fluid volume" },
];

export async function clientAction({ request }: Route.ClientActionArgs): Promise<ActionResult> {
  const form = await request.formData();
  const units = Object.fromEntries(MEASURES.map(({ measure }) => [measure, formString(form, measure)]));
  const parsed = unitChoicesZSchema.safeParse(units);
  if (!parsed.success) return { ok: false, error: "Choose a unit for each measurement.", issues: [] };
  try {
    await rpc.me.updatePreferences({ units: parsed.data });
    return { ok: true };
  } catch (e) {
    // No connection (fetch's TypeError): units still need one to save.
    if (e instanceof TypeError)
      return { ok: false, error: "You're offline. Connect to save your units.", issues: [] };
    return toActionResult(e);
  }
}

export default function UnitsSettings({ loaderData }: Route.ComponentProps) {
  const { units } = loaderData;
  const fetcher = useFetcher<ActionResult>();
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  return (
    <SettingsPage title="Units">
      <SettingsCard>
        <fetcher.Form method="post" className="space-y-1">
          <p className="text-base-content/70 text-sm">
            How vitals show for you. Everyone in your care groups can pick their own.
          </p>
          {MEASURES.map(({ measure, label }) => (
            <ChoiceGroup
              key={measure}
              name={measure}
              label={label}
              options={UNIT_OPTIONS[measure].map((unit) => ({ value: unit, label: UNIT_LABEL[unit] }))}
              defaultValue={units[measure]}
            />
          ))}
          <SaveRow busy={fetcher.state !== "idle"} result={result} />
        </fetcher.Form>
      </SettingsCard>
    </SettingsPage>
  );
}
