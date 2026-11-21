import { Info } from "lucide-react";
import { Button, Popover, TOOL_CIRCLE } from "~/components/ui";
import { Example } from "../Example";

export function PopoverSection() {
  return (
    <Example label="A small dialog beside its button">
      <Popover
        label="About doses"
        dialogLabel="About doses"
        className={TOOL_CIRCLE}
        trigger={<Info className="size-4" aria-hidden="true" />}
      >
        {(close) => (
          <div className="space-y-2">
            <p className="text-sm">A dose counts as taken when anyone in the group logs it.</p>
            <Button size="sm" onClick={close}>
              Done
            </Button>
          </div>
        )}
      </Popover>
    </Example>
  );
}
