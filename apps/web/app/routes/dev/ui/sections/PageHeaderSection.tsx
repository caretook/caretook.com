import { Plus } from "lucide-react";
import { Button, PageHeader } from "~/components/ui";
import { Example } from "../Example";

export function PageHeaderSection() {
  return (
    <Example label="A section page's title and actions">
      <PageHeader
        className="w-full"
        title="Providers"
        actions={
          <Button variant="primary" size="sm" icon={Plus}>
            Add
          </Button>
        }
      />
    </Example>
  );
}
