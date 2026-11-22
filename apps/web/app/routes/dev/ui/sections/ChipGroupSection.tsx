import { useState } from "react";
import { ChipGroup } from "~/components/ui";
import { Example } from "../Example";

export function ChipGroupSection() {
  const [pressed, setPressed] = useState(false);
  return (
    <>
      <Example label="Links (the current one filled)">
        <ChipGroup
          label="Kinds"
          links={[
            { id: "all", label: "All", to: "/dev/ui", current: true },
            { id: "notes", label: "Notes", to: "/dev/ui?kind=note", current: false },
            { id: "vitals", label: "Vitals", to: "/dev/ui?kind=vitals", current: false },
          ]}
        />
      </Example>
      <Example label="Buttons, one a toggle">
        <ChipGroup
          label="Suggestions"
          actions={[
            { id: "slept", label: "Slept well", onPress: () => undefined },
            { id: "pinned", label: "Pinned only", onPress: () => setPressed((p) => !p), pressed },
          ]}
        />
      </Example>
    </>
  );
}
