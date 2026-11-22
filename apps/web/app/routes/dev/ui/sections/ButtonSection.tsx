import { CalendarPlus, ChevronDown, Import, Pin, Plus, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Menu } from "~/components/ui";
import { Example } from "../Example";

export function ButtonSection() {
  const [busy, setBusy] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Example label="Tones">
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
        <Button variant="ghost">Show more</Button>
        <Button variant="danger">Delete</Button>
        <Button variant="dangerQuiet" icon={Trash2}>
          Remove
        </Button>
      </Example>
      <Example label="Sizes">
        <Button variant="primary" size="lg">
          Large
        </Button>
        <Button variant="primary">Medium</Button>
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" size="xs">
          Extra small
        </Button>
      </Example>
      <Example label="Shapes">
        <Button variant="primary">Rounded</Button>
        <Button variant="primary" shape="pill">
          Pill
        </Button>
        <Button variant="primary" icon={Plus} label="Square (add)" />
        <Button variant="primary" icon={Plus} label="Round (add)" shape="round" />
      </Example>
      <Example label="Icon only: every tone and size">
        <Button variant="primary" size="sm" icon={Plus} label="Add provider" />
        <Button variant="secondary" size="sm" icon={Import} label="Import from another group" />
        <Button variant="ghost" size="sm" icon={Printer} label="Print" />
        <Button variant="dangerQuiet" size="sm" icon={Trash2} label="Delete" />
        <Button variant="primary" size="lg" icon={Plus} label="Add (large)" />
        <Button variant="primary" icon={Plus} label="Add (medium)" />
        <Button variant="primary" size="xs" icon={Plus} label="Add (extra small)" />
      </Example>
      <Example label="A toggle and a disclosure">
        <Button icon={Pin} label="Pin" size="sm" pressed={pinned} onClick={() => setPinned((p) => !p)} />
        <Button
          variant="ghost"
          size="sm"
          icon={ChevronDown}
          expanded={open}
          controls="gallery-button-disclosure"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide details" : "Show details"}
        </Button>
        <span id="gallery-button-disclosure" hidden={!open} className="text-sm">
          The details.
        </span>
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
        <Button to="/dev/ui" variant="primary" size="sm" icon={Plus} label="Add (a link)" />
      </Example>
      <Example label="A menu trigger with a button's look">
        <Menu
          label="Add"
          title="Add"
          variant="primary"
          size="sm"
          shape="square"
          items={[
            { id: "appointment", label: "Appointment", icon: CalendarPlus, onAction: () => undefined },
            { id: "todo", label: "Todo", icon: Plus, onAction: () => undefined },
          ]}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Menu>
      </Example>
      <Example label="Full width">
        <Button variant="primary" block>
          Sign in
        </Button>
      </Example>
    </>
  );
}
