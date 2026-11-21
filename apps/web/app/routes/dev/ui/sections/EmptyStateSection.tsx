import { Plus } from "lucide-react";
import { EmptyState } from "~/components/ui";
import { Example } from "../Example";

export function EmptyStateSection() {
  return (
    <>
      <Example label="A quiet line">
        <EmptyState>No one is waiting.</EmptyState>
      </Example>
      <Example label="With an action (a link or a button)">
        <EmptyState action={{ label: "Add a provider", to: "/dev/ui", icon: Plus }}>
          No providers yet.
        </EmptyState>
        <EmptyState action={{ label: "Invite someone", onAction: () => undefined }}>
          No invites yet.
        </EmptyState>
      </Example>
    </>
  );
}
