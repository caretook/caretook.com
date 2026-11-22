import { useState } from "react";
import { Button, Toast } from "~/components/ui";
import { Example } from "../Example";

export function ToastSection() {
  const [shown, setShown] = useState(false);
  return (
    <Example label="Fixed at the bottom, above the tab bar">
      <Button onClick={() => setShown((s) => !s)}>{shown ? "Hide the toast" : "Show the toast"}</Button>
      {shown && (
        <Toast message="A new version is ready." actionLabel="Reload" onAction={() => setShown(false)} />
      )}
    </Example>
  );
}
