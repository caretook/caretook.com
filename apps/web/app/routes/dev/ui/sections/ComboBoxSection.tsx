import { useState } from "react";
import { ComboBox } from "~/components/ui";
import { Example } from "../Example";

const PROVIDERS = [
  { id: "p1", label: "Dr. Lena Okafor", description: "Primary care" },
  { id: "p2", label: "Dr. Omar Haddad", description: "Cardiology" },
  { id: "p3", label: "Maple Street Pharmacy" },
];

export function ComboBoxSection() {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const options = PROVIDERS.filter((p) => p.label.toLowerCase().includes(text.toLowerCase()));
  return (
    <Example label="Type to filter (the caller filters), with a create option">
      <div className="w-full max-w-sm">
        <ComboBox
          label="Provider"
          placeholder="Search providers"
          options={options}
          inputValue={text}
          onInputChange={setText}
          onSelect={(id) => {
            setPicked(id);
            setText(PROVIDERS.find((p) => p.id === id)?.label ?? "");
          }}
          createLabel={(t) => `Add “${t}”`}
          onCreate={(t) => setPicked(`new: ${t}`)}
        />
        {picked && <p className="mt-1 text-sm">Picked {picked}</p>}
      </div>
    </Example>
  );
}
