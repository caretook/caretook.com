import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui";
import { Example } from "../Example";

export function ButtonSection() {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Example label="Variants">
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
        <Button variant="ghost">Show more</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="dangerQuiet" icon={Trash2}>
          Remove
        </Button>
      </Example>
      <Example label="Sizes">
        <Button variant="primary">Medium</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="xs">
          Extra small
        </Button>
      </Example>
      <Example label="With an icon, disabled, busy">
        <Button icon={Plus}>Add a note</Button>
        <Button disabled>Disabled</Button>
        <Button variant="primary" busy={busy} busyLabel="Saving…" onClick={() => setBusy(true)}>
          Save (tap to go busy)
        </Button>
        {busy && (
          <Button variant="ghost" size="sm" onClick={() => setBusy(false)}>
            Reset
          </Button>
        )}
      </Example>
      <Example label="A link that looks the same">
        <Button to="/dev/ui" variant="primary">
          Go to the gallery
        </Button>
        <Button to="/dev/ui">Back</Button>
      </Example>
      <Example label="Full width">
        <Button variant="primary" block>
          Sign in
        </Button>
      </Example>
    </>
  );
}
