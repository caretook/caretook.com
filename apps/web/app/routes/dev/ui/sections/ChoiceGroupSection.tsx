import { useState } from "react";
import { ChoiceGroup } from "~/components/ui";
import { Example } from "../Example";

const UNITS = [
  { value: "imperial", label: "°F, lb" },
  { value: "metric", label: "°C, kg" },
] as const;

const PLACES = [
  { value: "home", label: "Home" },
  { value: "clinic", label: "Clinic" },
  { value: "rehab", label: "Rehab or skilled nursing" },
  { value: "other", label: "Other" },
] as const;

export function ChoiceGroupSection() {
  const [units, setUnits] = useState<"imperial" | "metric" | null>(null);
  const [place, setPlace] = useState<(typeof PLACES)[number]["value"] | null>("home");
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
      <Example label="Grid: two equal columns for a longer list">
        <ChoiceGroup
          name="place"
          label="Where is care now?"
          layout="grid"
          options={PLACES}
          value={place}
          onChange={setPlace}
        />
      </Example>
    </>
  );
}
