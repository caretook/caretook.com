import type { AllergyState } from "~/lib/medications/allergies";

import { ShieldAlert } from "lucide-react";
import { allergyText, NO_KNOWN_ALLERGIES, ALLERGIES_NOT_RECORDED } from "~/lib/medications/allergies";
import { Button, Section } from "~/components/ui";
import { appUrls } from "~/lib/app-shell/appUrls";

/**
 * The recipient's allergies, at the top of the medication list and each
 * medication's page, read-only: "Allergies: Penicillin (hives, severe) ·
 * Sulfa", a severe one in bold, "No known allergies", or "Allergies not
 * recorded". They're managed on the profile (fixes-ui slice 34): writers get
 * Manage, which opens the profile's allergies sheet (closing it lands on the
 * profile). Viewers get the text only.
 *
 * `band`: on a banded page (a medication's) it is a `Section` of its own,
 * holding the same box; without it (the list) it looks as it always has.
 */
export function AllergiesRegion({
  groupId,
  state,
  canWrite,
  band = false,
}: {
  groupId: string;
  state: AllergyState;
  canWrite: boolean;
  band?: boolean;
}) {
  const recorded = state.kind === "recorded";
  const severe = recorded && state.allergies.some((a) => a.severity === "severe");
  const box = `rounded-box flex items-start gap-2.5 border px-3 py-2 ${
    recorded ? "border-warning bg-warning/10" : "border-base-300"
  }`;
  const content = (
    <>
      <ShieldAlert
        className={`mt-0.5 size-5 shrink-0 ${severe ? "text-error-ink" : recorded ? "text-warning-ink" : "text-faint"}`}
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm wrap-break-word" data-allergies-text>
        {recorded ? (
          <>
            <span className="font-semibold">Allergies: </span>
            {state.allergies.map((a, i) => (
              <span key={a.id} data-allergy={a.id} data-severe={a.severity === "severe" ? "" : undefined}>
                {i > 0 && " · "}
                {a.severity === "severe" ? (
                  <strong className="text-error-ink font-semibold">{allergyText(a)}</strong>
                ) : (
                  allergyText(a)
                )}
              </span>
            ))}
          </>
        ) : state.kind === "none" ? (
          <span className="font-semibold">{NO_KNOWN_ALLERGIES}</span>
        ) : (
          <span className="text-muted">{ALLERGIES_NOT_RECORDED}</span>
        )}
      </p>
      {canWrite && (
        <Button
          to={appUrls.profileAllergies(groupId)}
          // Loaded ahead, so the profile and its sheet open offline too.
          prefetch="render"
          preventScrollReset
          variant="ghost"
          size="xs"
          className="shrink-0"
          data-manage-allergies=""
        >
          Manage<span className="sr-only"> allergies on the profile</span>
        </Button>
      )}
    </>
  );
  if (band) {
    return (
      <Section aria-label="Allergies" id="allergies" data-allergies={state.kind}>
        <div className={box}>{content}</div>
      </Section>
    );
  }
  return (
    <section aria-label="Allergies" className={box} data-allergies={state.kind}>
      {content}
    </section>
  );
}
