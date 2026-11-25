import { Button, toast } from "~/components/ui";
import { Example } from "../Example";

// The shared toasts (B-669): one at a time, the newest; the rest wait behind it.
export function ToastSection() {
  return (
    <>
      <Example label="A finished action, with Undo (6 s)">
        <Button onClick={() => toast({ message: "Note deleted", undo: () => {} })}>Undo toast</Button>
      </Example>
      <Example label="Background news, an action and no time limit">
        <Button
          onClick={() =>
            toast({
              message: "A new version is ready",
              action: { label: "Reload", onAction: () => {} },
              timeout: null,
            })
          }
        >
          Reload toast
        </Button>
      </Example>
      <Example label="A message alone (6 s)">
        <Button onClick={() => toast({ message: "Saved to this device" })}>Plain toast</Button>
      </Example>
    </>
  );
}
