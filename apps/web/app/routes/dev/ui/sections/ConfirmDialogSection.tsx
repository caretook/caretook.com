import { useState } from "react";
import { Button, ConfirmDialog } from "~/components/ui";
import { Example } from "../Example";

export function ConfirmDialogSection() {
  const [open, setOpen] = useState<"delete" | "copy" | null>(null);
  return (
    <Example label="Destructive (solid red) and plain">
      <Button variant="dangerQuiet" onClick={() => setOpen("delete")}>
        Delete note…
      </Button>
      <Button onClick={() => setOpen("copy")}>Copy to another group…</Button>
      <ConfirmDialog
        open={open === "delete"}
        title="Delete this note?"
        message="It goes for everyone in the group."
        confirmLabel="Delete"
        onConfirm={() => setOpen(null)}
        onClose={() => setOpen(null)}
      />
      <ConfirmDialog
        open={open === "copy"}
        title="Copy Dr. Lena Okafor?"
        confirmLabel="Copy"
        confirmVariant="primary"
        onConfirm={() => setOpen(null)}
        onClose={() => setOpen(null)}
      />
    </Example>
  );
}
