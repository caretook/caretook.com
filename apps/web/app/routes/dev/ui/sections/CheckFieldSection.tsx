import { CheckField } from "~/components/ui";
import { Example } from "../Example";

export function CheckFieldSection() {
  return (
    <>
      <Example label="Plain, with help, checked">
        <div className="w-full space-y-2">
          <CheckField label="The evening before" defaultChecked />
          <CheckField label="Phone numbers" help="(555) 010-0142" />
        </div>
      </Example>
      <Example label="With an error, and disabled">
        <div className="w-full space-y-2">
          <CheckField
            label="I know this person and want them to see the care group."
            error="Confirm that you know them."
          />
          <CheckField label="3 days before" disabled />
        </div>
      </Example>
    </>
  );
}
