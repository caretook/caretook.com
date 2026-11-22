import { useState } from "react";
import { Button, FormFooter, Sheet } from "~/components/ui";
import { Example } from "../Example";

export function SheetSection() {
  const [open, setOpen] = useState(false);
  return (
    <Example label="Full screen on a phone, a centred modal from sm">
      <Button onClick={() => setOpen(true)}>Open the sheet</Button>
      <Sheet isOpen={open} onOpenChange={setOpen} title="New note">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          <p>Grandma Rosa had soup for lunch and walked to the mailbox.</p>
          <FormFooter submitLabel="Save" cancel={{ label: "Cancel", onCancel: () => setOpen(false) }} />
        </form>
      </Sheet>
    </Example>
  );
}
