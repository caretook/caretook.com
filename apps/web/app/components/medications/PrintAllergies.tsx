import type { AllergyState } from "~/lib/medications/allergies";

import { allergySummary, allergyText } from "~/lib/medications/allergies";

/**
 * The printed sheets' allergies block, at their top: each allergy on file
 * ("Penicillin (hives, severe)"), or "No known allergies", or "Allergies not
 * recorded", so an empty block is never read as none.
 */
export function PrintAllergies({ state }: { state: AllergyState }) {
  return (
    <section
      aria-labelledby="print-allergies"
      className="border-base-content/40 space-y-1 border-2 px-3 py-2"
      data-print-section="print-allergies"
      data-print-allergies={state.kind}
    >
      <h2 id="print-allergies" className="text-base font-semibold">
        Allergies
      </h2>
      {state.kind === "recorded" ? (
        <ul className="list-disc ps-5 text-sm">
          {state.allergies.map((a) => (
            <li
              key={a.id}
              className={a.severity === "severe" ? "font-semibold" : undefined}
              data-print-allergy
            >
              {allergyText(a)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-semibold">{allergySummary(state)}</p>
      )}
    </section>
  );
}
