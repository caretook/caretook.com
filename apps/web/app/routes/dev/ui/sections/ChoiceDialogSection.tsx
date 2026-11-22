import { useState } from "react";
import { Button, ChoiceDialog } from "~/components/ui";
import { Example } from "../Example";

export function ChoiceDialogSection() {
  const [open, setOpen] = useState<"change" | "delete" | null>(null);
  const close = () => setOpen(null);
  return (
    <Example label="Plain (primary, secondary) and destructive (danger, dangerQuiet)">
      <Button onClick={() => setOpen("change")}>Change a repeating visit…</Button>
      <Button variant="dangerQuiet" onClick={() => setOpen("delete")}>
        Delete a repeating todo…
      </Button>
      <ChoiceDialog
        open={open === "change"}
        title="Change a repeating appointment"
        message="Change only this visit, or this one and the visits after it? Past visits stay as they were."
        choices={[
          { id: "only", label: "Only this visit", tone: "primary" },
          { id: "later", label: "This and later visits", tone: "secondary" },
        ]}
        cancelLabel="Cancel"
        onChoose={close}
        onClose={close}
      />
      <ChoiceDialog
        open={open === "delete"}
        title="Delete this repeating todo?"
        message="Skip this one and the next “Water the plants” comes on its day, or delete it and stop repeating."
        choices={[
          { id: "skip", label: "Skip this one", tone: "primary" },
          { id: "stop", label: "Delete and stop repeating", tone: "dangerQuiet" },
        ]}
        cancelLabel="Cancel"
        onChoose={close}
        onClose={close}
      />
    </Example>
  );
}
