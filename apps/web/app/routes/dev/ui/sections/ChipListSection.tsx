import { useState } from "react";
import { ChipList } from "~/components/ui";
import { Example } from "../Example";

const START = [
  { id: "p1", label: "Dr. Lena Okafor", to: "/dev/ui" },
  { id: "p2", label: "Maple Street Pharmacy", to: null },
];

export function ChipListSection() {
  const [chips, setChips] = useState(START);
  return (
    <Example label="Linked things, each removable">
      <ChipList
        label="Linked providers"
        chips={chips.map((chip) => ({
          ...chip,
          onRemove: () => setChips((all) => all.filter((c) => c.id !== chip.id)),
        }))}
      />
      <ChipList
        label="A muted chip"
        chips={[{ id: "gone", label: "Former clinic", to: null, muted: true }]}
      />
    </Example>
  );
}
