import { useId, useState } from "react";
import { Button, Chevron, Collapse, List, ListRow } from "~/components/ui";
import { Example } from "../Example";

// Motion (ui-kit-2): what moves, with the kit's durations; under "reduce
// motion" every one of these changes at once.
export function MotionSection() {
  const [open, setOpen] = useState(false);
  const [turned, setTurned] = useState(false);
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
    </>
  );
}
