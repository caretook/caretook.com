import { Plus, Stethoscope } from "lucide-react";
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
      <Example label="A section's main list (its icon and accent)">
        <EmptyState icon={Stethoscope} accent="lime" action={{ label: "Add a provider", to: "/dev/ui" }}>
          No providers yet.
        </EmptyState>
      </Example>
    </>
  );
}
