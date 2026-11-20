import type { Measure } from "@caretook/data/schema";
import type { Route } from "./+types/route";
import type { ActionResult } from "~/lib/core/api";

import { UNIT_LABEL, UNIT_OPTIONS, unitChoicesZSchema } from "@caretook/data/schema";
import { useFetcher } from "react-router";
import { SaveRow, SettingsCard, SettingsPage } from "~/components/settings";
import { ChoiceGroup } from "~/components/ui";
import { toActionResult } from "~/lib/core/api";
import { formString } from "~/lib/core/form";
import { loadSettings, saveSettings } from "~/lib/app-shell/me";
import { sessionContext } from "~/lib/auth/session";

// `/app/settings/units`. Shared by web + native: client-only data
// (clientLoader/clientAction). Units save through `saveSettings`, like the
// timeline layout: cached at once, and kept pending on this device while
// offline (the next online `loadSettings` sends them).

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

/** "Saved.", or, offline, saved on this device and pending. */
type UnitsResult = ActionResult | { ok: true; pending: true };

export async function clientAction({ request, context }: Route.ClientActionArgs): Promise<UnitsResult> {
  const { user } = context.get(sessionContext);
  const form = await request.formData();
  const units = Object.fromEntries(MEASURES.map(({ measure }) => [measure, formString(form, measure)]));
  const parsed = unitChoicesZSchema.safeParse(units);
  if (!parsed.success) return { ok: false, error: "Choose a unit for each measurement.", issues: [] };
  try {
    const outcome = await saveSettings(user.id, { units: parsed.data });
    return outcome === "pending" ? { ok: true, pending: true } : { ok: true };
  } catch (e) {
    return toActionResult(e);
  }
}

const PENDING_TEXT = "Saved on this device. It'll sync when you're back online.";

export default function UnitsSettings({ loaderData }: Route.ComponentProps) {
  const { units } = loaderData;
  const fetcher = useFetcher<UnitsResult>();
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
          <SaveRow
            busy={fetcher.state !== "idle"}
            result={result}
            savedText={result && "pending" in result ? PENDING_TEXT : undefined}
          />
        </fetcher.Form>
      </SettingsCard>
    </SettingsPage>
  );
}
