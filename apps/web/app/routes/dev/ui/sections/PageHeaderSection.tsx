import { CalendarCheck, CalendarPlus, Import, ListTodo, Pill, Printer } from "lucide-react";
import { useState } from "react";
import { Button, PageHeader } from "~/components/ui";
import { Example } from "../Example";

export function PageHeaderSection() {
  const [added, setAdded] = useState(0);
  return (
    <>
      <Example label="The add control as a link, an action to its left">
        <PageHeader
          className="w-full"
          title="Providers"
          actions={<Button size="sm" icon={Import} label="Import from another group" to="?import" />}
          add={{ label: "Add provider", to: "?add" }}
        />
      </Example>
      <Example label="The add control as a callback, with a description">
        <PageHeader
          className="w-full"
          title="Care periods"
          description={`Where Robin’s care has been${added ? ` · added ${added}` : ""}`}
          add={{ label: "Add period", onPress: () => setAdded((n) => n + 1) }}
        />
      </Example>
      <Example label="The add control as a menu, other actions to its left">
        <PageHeader
          className="w-full"
          title="Planner"
          actions={
            <Button size="sm" variant="ghost" icon={Printer}>
              Print
            </Button>
          }
          add={{
            label: "Add",
            items: [
              { id: "appointment", label: "Appointment", icon: CalendarPlus, onAction: () => undefined },
              { id: "todo", label: "Todo", icon: ListTodo, onAction: () => undefined },
            ],
          }}
        />
      </Example>
      <Example label="With a section's chip">
        <PageHeader
          className="w-full"
          title="Medications"
          icon={Pill}
          accent="teal"
          add={{ label: "Add medication", to: "?add" }}
        />
      </Example>
      <Example label="With a section's chip and a description">
        <PageHeader
          className="w-full"
          title="Planner"
          description="What’s coming up for Robin"
          icon={CalendarCheck}
          accent="orange"
        />
      </Example>
      <Example label="No add control (a viewer)">
        <PageHeader className="w-full" title="Providers" />
      </Example>
    </>
  );
}
