import { Message } from "~/components/ui";
import { Example } from "../Example";

export function MessageSection() {
  return (
    <>
      <Example label="Tones (error is an alert, the rest statuses)">
        <div className="space-y-1">
          <Message tone="error">Couldn't save: the name is taken.</Message>
          <Message tone="success">Saved.</Message>
          <Message tone="warning">Only owners can change this.</Message>
          <Message tone="info">Link copied.</Message>
        </div>
      </Example>
      <Example label="Empty (mounted, takes no space)">
        <Message tone="error" />
      </Example>
    </>
  );
}
