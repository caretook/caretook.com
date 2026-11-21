import { DateTimeField } from "~/components/ui/date";
import { Example } from "../Example";

export function DateTimeFieldSection() {
  return (
    <>
      <Example label="Date and time">
        <div className="w-full max-w-sm">
          <DateTimeField label="When" defaultValue="2026-11-21T17:30:00Z" />
        </div>
      </Example>
      <Example label="A day alone, with an error">
        <div className="w-full max-w-sm">
          <DateTimeField
            label="Due"
            granularity="day"
            defaultValue="2026-11-21T17:30:00Z"
            error="Pick a day on or after today."
          />
        </div>
      </Example>
    </>
  );
}
