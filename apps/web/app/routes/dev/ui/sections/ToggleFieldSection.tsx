import { ToggleField } from "~/components/ui";
import { Example } from "../Example";

export function ToggleFieldSection() {
  return (
    <>
      <Example label="Off, on, with help">
        <div className="w-full space-y-2">
          <ToggleField label="Email me reminders" />
          <ToggleField label="Allow members to connect assistants" defaultChecked />
          <ToggleField
            label="Include titles, places and providers"
            help="They appear in your own emails, feed and Google Calendar."
          />
        </div>
      </Example>
      <Example label="With an error, and disabled">
        <div className="w-full space-y-2">
          <ToggleField label="Easy mode" error="Couldn't save that. Try again." />
          <ToggleField label="Let members include details" disabled defaultChecked />
        </div>
      </Example>
    </>
  );
}
