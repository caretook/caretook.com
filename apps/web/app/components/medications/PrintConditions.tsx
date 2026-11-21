import type { ConditionLike, ConditionState } from "~/lib/profiles/conditions";

import { conditionText, NO_KNOWN_CONDITIONS } from "~/lib/profiles/conditions";

/**
 * The printed medication sheets' conditions block, under the allergies: each
 * active condition ("Type 2 diabetes (since 2015)") or "No known conditions".
 * Left out when conditions aren't recorded (or all are past), so a blank is
 * never read as none.
 */
export function PrintConditions({ state }: { state: ConditionState<ConditionLike> }) {
  if (state.kind === "notRecorded" || (state.kind === "recorded" && !state.active.length)) return null;
  return (
    <section
      aria-labelledby="print-conditions"
      className="border-base-content/40 space-y-1 border px-3 py-2"
      data-print-section="print-conditions"
      data-print-conditions={state.kind}
    >
      <h2 id="print-conditions" className="text-base font-semibold">
        Conditions
      </h2>
      {state.kind === "recorded" ? (
        <ul className="list-disc ps-5 text-sm">
          {state.active.map((c) => (
            <li key={c.id} data-print-condition>
              {conditionText(c)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-semibold">{NO_KNOWN_CONDITIONS}</p>
      )}
    </section>
  );
}
