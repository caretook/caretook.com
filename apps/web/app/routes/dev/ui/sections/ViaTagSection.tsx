import { ViaTag } from "~/components/ui";
import { Example } from "../Example";

export function ViaTagSection() {
  return (
    <Example label="An entry added through a member's assistant">
      <span>Walked to the park</span>
      <ViaTag via="Claude" />
    </Example>
  );
}
