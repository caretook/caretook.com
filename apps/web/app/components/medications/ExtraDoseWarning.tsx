import type { DuePass } from "~/lib/medications/duePasses";

import { TriangleAlert } from "lucide-react";
import { Badge } from "~/components/ui";
import { extraDoseText, medicationTitle } from "~/lib/medications/medicationDisplay";

/**
 * A double dose called out: a warning badge ("Double dose") and the plain
 * text saying when each was given ("Given twice: 8:00 and 8:20"), so it reads
 * without the colour. Today's rows and pass cards, the Passes tab's cards,
 * and the medication page.
 */
export function ExtraDoseWarning({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`.trim()}
      data-extra-dose=""
    >
      <Badge tone="warning" icon={TriangleAlert} className="shrink-0" data-extra-dose-badge="">
        Double dose
      </Badge>
      <span data-extra-dose-text="">{text}</span>
    </p>
  );
}

/**
 * Each medication given twice in today's pass, one warning apiece and named
 * ("Xa 5 mg: Given twice: 8:00 and 8:20"), so a card reads without opening
 * it (Today's `PassCard`, the Passes tab). Nothing for single doses.
 */
export function PassExtraDoseWarnings({
  pass,
  timeZone,
  className,
}: {
  pass: DuePass;
  timeZone: string;
  className?: string;
}) {
  return pass.slots.map((slot) => {
    const text = extraDoseText(slot, timeZone);
    return text ? (
      <ExtraDoseWarning
        key={slot.medication.id}
        text={`${medicationTitle(slot.medication)}: ${text}`}
        className={className}
      />
    ) : null;
  });
}
