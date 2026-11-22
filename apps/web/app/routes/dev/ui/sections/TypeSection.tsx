import { TITLE_PAGE, TITLE_SECTION, TITLE_SUB } from "~/components/ui";
import { Example } from "../Example";

// The typeface (B-415): Atkinson Hyperlegible Next, set as --font-sans in app.css.
const WEIGHTS = [
  { className: "font-normal", label: "Regular 400" },
  { className: "font-medium", label: "Medium 500" },
  { className: "font-semibold", label: "Semibold 600" },
  { className: "font-bold", label: "Bold 700" },
] as const;

/** Pairs that look alike in many faces, and must not here. */
const LOOK_ALIKES = ["I l 1 |", "O 0 o", "rn m", "S 5", "B 8", "Z 2", "g 9 q"] as const;

export function TypeSection() {
  return (
    <div className="space-y-4">
      <Example label="The heading scale, body and small text">
        <div className="space-y-1">
          <p className={TITLE_PAGE}>Medications</p>
          <p className={TITLE_SECTION}>Morning pass</p>
          <p className={TITLE_SUB}>Taken with food</p>
          <p>Lisinopril 10 mg, one tablet by mouth each morning.</p>
          <p className="text-sm">Last given at 8:05 AM by Sam.</p>
          <p className="text-xs">Refill due Jun 30</p>
        </div>
      </Example>
      <Example label="The weights in use">
        <div className="space-y-1">
          {WEIGHTS.map((w) => (
            <p key={w.className} className={w.className}>
              {w.label}: Amoxicillin 250 mg
            </p>
          ))}
          <p className="italic">Italic: as needed, at most 4 in 24 hours</p>
        </div>
      </Example>
      <Example label="Numerals: proportional, then tabular">
        <div className="space-y-1">
          <p>0 1 2 3 4 5 6 7 8 9 · 0.5 mg · 12.5 mL · 1/2 tablet</p>
          <p className="tabular-nums">
            11:10 AM
            <br />
            08:45 PM
          </p>
        </div>
      </Example>
      <Example label="Look-alike pairs">
        <p className="text-2xl" data-look-alikes="">
          {LOOK_ALIKES.join("   ")}
        </p>
      </Example>
      <Example label="Code keeps the monospace stack">
        <code>I l 1 O 0</code>
      </Example>
    </div>
  );
}
