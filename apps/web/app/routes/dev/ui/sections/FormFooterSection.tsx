import type { FormEvent } from "react";

import { FormFooter } from "~/components/ui";
import { Example } from "../Example";

const noSubmit = (event: FormEvent) => event.preventDefault();

export function FormFooterSection() {
  return (
    <>
      <Example label="Right-aligned, Cancel as a link">
        <form onSubmit={noSubmit} className="w-full">
          <FormFooter submitLabel="Save" cancel={{ label: "Cancel", to: "/dev/ui" }} />
        </form>
      </Example>
      <Example label="Cancel as a callback, busy">
        <form onSubmit={noSubmit} className="w-full">
          <FormFooter
            submitLabel="Save"
            busy
            busyLabel="Saving…"
            cancel={{ label: "Cancel", onCancel: () => undefined }}
          />
        </form>
      </Example>
      <Example label="Start-aligned with a status (settings)">
        <form onSubmit={noSubmit} className="w-full">
          <FormFooter
            align="start"
            submitLabel="Save"
            status={
              <p role="status" className="text-success">
                Saved.
              </p>
            }
          />
        </form>
      </Example>
      <Example label="A form whose one job is the destructive act">
        <form onSubmit={noSubmit} className="w-full">
          <FormFooter danger submitLabel="Delete group" cancel={{ label: "Keep it", to: "/dev/ui" }} />
        </form>
      </Example>
    </>
  );
}
