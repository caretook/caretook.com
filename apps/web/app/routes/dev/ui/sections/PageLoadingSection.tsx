import { PageLoading } from "~/components/ui";
import { Example } from "../Example";

// Each example is a page's `main` in a framed box; Go back does nothing here.
const noop = () => undefined;

export function PageLoadingSection() {
  return (
    <>
      <Example label="PageLoading: the mark, spinner and message, centred under the header">
        <div className="bg-base-200 w-full rounded-box">
          <PageLoading message="Syncing your care groups…" slowAfter={null} />
        </div>
      </Example>
      <Example label="With Go back from the start">
        <div className="bg-base-200 w-full rounded-box">
          <PageLoading message="Opening the timeline…" back slowAfter={null} onBack={noop} />
        </div>
      </Example>
      <Example label="Slow: the prompt and Go back (here after 0 s; 10 s by default)">
        <div className="bg-base-200 w-full rounded-box">
          <PageLoading message="Loading the Planner…" slowAfter={0} onBack={noop} />
        </div>
      </Example>
    </>
  );
}
