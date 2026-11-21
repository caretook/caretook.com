import { useState } from "react";
import { ChoiceGroup } from "~/components/ui";
import { Example } from "../Example";

const UNITS = [
  { value: "imperial", label: "°F, lb" },
  { value: "metric", label: "°C, kg" },
] as const;

export function ChoiceGroupSection() {
  const [units, setUnits] = useState<"imperial" | "metric" | null>(null);
  return (
    <>
      <Example label="Controlled, none chosen yet">
        <ChoiceGroup name="units" label="Units" options={UNITS} value={units} onChange={setUnits} />
      </Example>
      <Example label="With an error">
        <ChoiceGroup
          name="units-error"
          label="Units"
          options={UNITS}
          value={null}
          onChange={() => undefined}
          error="Pick one."
        />
      </Example>
    </>
  );
}
