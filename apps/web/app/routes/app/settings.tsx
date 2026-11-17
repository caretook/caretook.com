import type { Measure, UnitChoices } from "@caretook/data/schema";
import type { Route } from "./+types/settings";
import type { ActionResult } from "~/lib/api";

import { UNIT_LABEL, UNIT_OPTIONS, unitChoicesZSchema } from "@caretook/data/schema";
import { useFetcher } from "react-router";
import { load, toActionResult } from "~/lib/api";
import { formString } from "~/lib/form";
import { rpc } from "~/lib/rpc";

// Shared by web + native: client-only data (clientLoader/clientAction over oRPC).

export const meta = () => [{ title: "Settings · Caretook" }];

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const me = await load(request, rpc.me.get());
  return { units: me.units };
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
    return toActionResult(e);
  }
}

export default function Settings({ loaderData }: Route.ComponentProps) {
  const { units } = loaderData;
  const fetcher = useFetcher<ActionResult>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section aria-labelledby="units-heading" className="card bg-base-100 shadow-sm">
        <fetcher.Form method="post" className="card-body">
          <h2 id="units-heading" className="card-title text-lg">
            Units
          </h2>
          <p className="text-base-content/70 text-sm">
            How vitals show for you. Everyone in your care groups can pick their own.
          </p>
          {MEASURES.map(({ measure, label }) => (
            <UnitChoice key={measure} measure={measure} label={label} value={units[measure]} />
          ))}
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            {result?.ok && (
              <p role="status" className="text-success text-sm">
                Saved.
              </p>
            )}
            {result && !result.ok && (
              <p role="alert" className="text-error text-sm">
                {result.error}
              </p>
            )}
          </div>
        </fetcher.Form>
      </section>
    </main>
  );
}

function UnitChoice({
  measure,
  label,
  value,
}: {
  measure: Measure;
  label: string;
  value: UnitChoices[Measure];
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset-legend">{label}</legend>
      <div className="join">
        {UNIT_OPTIONS[measure].map((unit) => (
          <input
            key={unit}
            type="radio"
            name={measure}
            value={unit}
            aria-label={UNIT_LABEL[unit]}
            defaultChecked={value === unit}
            className="join-item btn btn-sm"
          />
        ))}
      </div>
    </fieldset>
  );
}
