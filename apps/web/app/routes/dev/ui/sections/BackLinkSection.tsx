import { BackLink } from "~/components/ui";
import { Example } from "../Example";

export function BackLinkSection() {
  return (
    <Example label="Above a page's heading">
      <BackLink to="/dev/ui" label="Providers" />
    </Example>
  );
}
