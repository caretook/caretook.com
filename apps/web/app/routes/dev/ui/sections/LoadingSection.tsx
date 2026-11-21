import { Loading, Skeleton } from "~/components/ui";
import { Example } from "../Example";

export function LoadingSection() {
  return (
    <>
      <Example label="Loading (a spinner and its label)">
        <Loading label="Loading…" />
      </Example>
      <Example label="Loading with skeleton lines">
        <Loading label="Loading members…" lines={3} className="w-full" />
      </Example>
      <Example label="Skeleton (hidden from assistive tech)">
        <Skeleton lines={1} className="w-48" />
      </Example>
    </>
  );
}
