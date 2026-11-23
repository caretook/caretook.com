import { TimeSelect } from "~/components/ui";
import { Example } from "../Example";

export function TimeSelectSection() {
  return (
    <>
      <Example label="On the quarter hour">
        <TimeSelect label="Time" defaultValue="08:30" className="w-44" />
      </Example>
      <Example label="A saved time off the quarters">
        <TimeSelect label="Saved time" defaultValue="08:10" className="w-44" />
      </Example>
      <Example label="Optional, with an error">
        <TimeSelect label="Due time" optional error="Pick a time." className="w-44" />
      </Example>
    </>
  );
}
