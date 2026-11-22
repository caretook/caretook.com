import { Page, PageHeader } from "~/components/ui";
import { Example } from "../Example";

export function PageSection() {
  return (
    <>
      <Example label="Page: the default column (max-w-2xl) and the wide one (max-w-4xl)">
        <div className="bg-base-200 w-full space-y-2 py-2">
          <Page width="default" className="bg-base-100 !py-3" aria-label="Default page">
            <PageHeader title="Default width" />
          </Page>
          <Page width="wide" className="bg-base-100 !py-3" aria-label="Wide page">
            <PageHeader title="Wide" />
          </Page>
        </div>
      </Example>
    </>
  );
}
