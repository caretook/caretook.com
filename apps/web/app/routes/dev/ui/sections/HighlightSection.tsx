import { Highlight } from "~/components/ui";
import { Example } from "../Example";

const TEXT = "Rosa slept well and ate a full breakfast.";

export function HighlightSection() {
  return (
    <Example label="A search's matches">
      <p>
        <Highlight text={TEXT} ranges={[{ start: 5, end: 10 }]} />
      </p>
    </Example>
  );
}
