import { Heart } from "lucide-react";
import { ACCENTS, accentClass, IconChip } from "~/components/ui";
import { Example } from "../Example";

const ALL = [...ACCENTS, "neutral"] as const;

export function IconChipSection() {
  return (
    <>
      <Example label="Solid">
        {ALL.map((accent) => (
          <IconChip key={accent} icon={Heart} accent={accent} look="solid" label={`${accent}, solid`} />
        ))}
      </Example>
      <Example label="Soft">
        {ALL.map((accent) => (
          <IconChip key={accent} icon={Heart} accent={accent} look="soft" label={`${accent}, soft`} />
        ))}
      </Example>
      <Example label="Text">
        {ALL.map((accent) => (
          <span key={accent} className={`text-sm font-medium ${accentClass(accent, "text")}`}>
            {accent}
          </span>
        ))}
      </Example>
      <Example label="Sizes and shapes">
        <IconChip icon={Heart} accent="teal" size="sm" />
        <IconChip icon={Heart} accent="teal" size="md" />
        <IconChip icon={Heart} accent="teal" size="lg" />
        <IconChip icon={Heart} accent="plum" size="sm" shape="rounded" />
        <IconChip icon={Heart} accent="plum" size="md" shape="rounded" />
        <IconChip icon={Heart} accent="plum" size="lg" shape="rounded" />
      </Example>
    </>
  );
}
