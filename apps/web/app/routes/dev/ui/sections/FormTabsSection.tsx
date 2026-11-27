import { CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Field, FormTabs, revealField } from "~/components/ui";
import { Example } from "../Example";

/**
 * Form tabs, in the page tabs' look: a medication form's three sections
 * (fictional). Refills' Rx number is required, so Save from Essentials
 * switches there and marks the tab; "Show a server issue" marks Details'
 * field and reveals it, as a refused save would.
 */
export function FormTabsSection() {
  const form = useRef<HTMLFormElement>(null);
  const [issue, setIssue] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Example label="A form's sections">
      <form
        ref={form}
        className="w-full max-w-md space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <FormTabs
          label="Example medication sections"
          tabs={[
            {
              id: "essentials",
              label: "Essentials",
              panel: (
                <Field label="Name" kind="input" required>
                  {(control) => <input {...control} name="name" defaultValue="Ibuprofen" />}
                </Field>
              ),
            },
            {
              id: "details",
              label: "Details",
              hasContent: true,
              panel: (
                <Field label="Directions" kind="input" error={issue ? "Too long." : undefined}>
                  {(control) => <input {...control} name="directions" defaultValue="With food" />}
                </Field>
              ),
            },
            {
              id: "refills",
              label: "Refills",
              panel: (
                <Field label="Rx number" kind="input" required>
                  {(control) => <input {...control} name="rx" required />}
                </Field>
              ),
            },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save</Button>
          <Button
            variant="ghost"
            icon={CircleAlert}
            onClick={() => {
              setIssue(true);
              requestAnimationFrame(() => revealField(form.current));
            }}
          >
            Show a server issue
          </Button>
        </div>
        {saved && <p role="status">Saved.</p>}
      </form>
    </Example>
  );
}
