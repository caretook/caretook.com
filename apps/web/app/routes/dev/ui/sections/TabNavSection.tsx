import { TabNav } from "~/components/ui";
import { Example } from "../Example";

export function TabNavSection() {
  return (
    <Example label="A page's linked tabs (the first claims this page)">
      <TabNav
        className="w-full"
        label="Medications"
        tabs={[
          { label: "Schedule", to: "/dev/ui", match: () => true },
          { label: "List", to: "/dev/ui?tab=list", match: () => false },
          { label: "Passes", to: "/dev/ui?tab=passes", match: () => false },
        ]}
      />
    </Example>
  );
}
