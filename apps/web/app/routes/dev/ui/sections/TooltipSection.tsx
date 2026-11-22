import { Pencil } from "lucide-react";
import { IconButton } from "~/components/ui";
import { Tooltip } from "~/components/ui/tooltip";
import { Example } from "../Example";

export function TooltipSection() {
  return (
    <Example label="On hover and keyboard focus, never on touch">
      <Tooltip content="Last edited by Sam Park">
        <button type="button" className="link text-sm">
          Edited
        </button>
      </Tooltip>
      <IconButton label="Edit" icon={Pencil} onPress={() => undefined} />
    </Example>
  );
}
