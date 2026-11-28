import { CircleOff } from "lucide-react";
import { useState } from "react";
import { avatarColorClass, Swatch, SwatchGroup } from "~/components/ui";
import { Example } from "../Example";

const COLORS = ["coral", "jade", "sky", "violet"] as const;

export function SwatchSection() {
  const [color, setColor] = useState<string | null>("jade");
  return (
    <Example label="A color choice, with a Default">
      <SwatchGroup label="Color">
        <Swatch
          name="gallery-swatch"
          label="Default"
          checked={color === null}
          onChange={() => setColor(null)}
          className="bg-base-200 text-base-content border-base-300 border"
        >
          <CircleOff aria-hidden="true" className="size-5" />
        </Swatch>
        {COLORS.map((c) => (
          <Swatch
            key={c}
            name="gallery-swatch"
            label={c.charAt(0).toUpperCase() + c.slice(1)}
            checked={color === c}
            onChange={() => setColor(c)}
            className={avatarColorClass(c) ?? ""}
          />
        ))}
      </SwatchGroup>
    </Example>
  );
}
