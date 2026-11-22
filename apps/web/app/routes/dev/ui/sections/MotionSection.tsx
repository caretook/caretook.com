import { useId, useState } from "react";
import {
  Button,
  Chevron,
  Collapse,
  ConfirmDialog,
  List,
  ListRow,
  Menu,
  Popover,
  Toast,
} from "~/components/ui";
import { Example } from "../Example";

// Motion (ui-kit-2, overlays ui-kit-3): what moves, with the kit's
// durations; under "reduce motion" every one of these changes at once.
export function MotionSection() {
  const [open, setOpen] = useState(false);
  const [turned, setTurned] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState(false);
  const id = useId();
  return (
    <>
      <Example label="Buttons (hover, press)">
        <Button variant="primary">Save</Button>
        <Button>Cancel</Button>
        <Button variant="ghost">Show more</Button>
      </Example>
      <Example label="A link row (hover, press)">
        <List label="Pharmacies" className="w-full">
          <ListRow to="/dev/ui">
            <p className="font-medium">Corner Pharmacy</p>
            <p className="text-muted text-sm">Open until 9 pm</p>
          </ListRow>
        </List>
      </Example>
      <Example label="Chevron (closed right, or down)">
        <Button size="sm" pressed={turned} onClick={() => setTurned((t) => !t)}>
          Turn
        </Button>
        <Chevron open={turned} />
        <Chevron open={turned} closed="down" />
      </Example>
      <Example label="Collapse (an expander with its chevron)">
        <div className="w-full">
          <button
            type="button"
            className="motion-colors hover:text-base-content text-muted flex items-center gap-1 text-sm"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
          >
            <Chevron open={open} />
            Visit notes
          </button>
          <Collapse open={open} id={id}>
            <ul className="mt-1 space-y-0.5 pl-5 text-sm">
              <li>Ask about the new walking frame.</li>
              <li>Bring the blood pressure log.</li>
            </ul>
          </Collapse>
        </div>
      </Example>
      <Example label="Overlays fade in and out (menu, popover: fast; dialog, toast: the default)">
        <Menu
          label="Note actions"
          variant="secondary"
          items={[{ id: "delete", label: "Delete…", tone: "danger", onAction: () => setConfirming(true) }]}
        >
          Menu
        </Menu>
        <Popover label="About doses" dialogLabel="About doses" trigger="Popover" className="btn">
          <p className="text-sm">A dose counts as taken when anyone in the group logs it.</p>
        </Popover>
        <Button onClick={() => setConfirming(true)}>Dialog</Button>
        <Button onClick={() => setToast((t) => !t)}>{toast ? "Hide the toast" : "Toast"}</Button>
        <ConfirmDialog
          open={confirming}
          title="Delete this note?"
          message="It goes for everyone in the group."
          confirmLabel="Delete"
          onConfirm={() => setConfirming(false)}
          onClose={() => setConfirming(false)}
        />
        <Toast
          open={toast}
          message="Added Ibuprofen"
          actionLabel="Add details"
          onAction={() => setToast(false)}
        />
      </Example>
    </>
  );
}
