import { Pencil, Pin, Settings } from "lucide-react";
import { useState } from "react";
import { IconButton } from "~/components/ui";
import { Example } from "../Example";

export function IconButtonSection() {
  const [pinned, setPinned] = useState(false);
  return (
    <Example label="Ghost, toggle, link, medium">
      <IconButton label="Edit" icon={Pencil} onPress={() => undefined} />
      <IconButton label="Pin" icon={Pin} pressed={pinned} onPress={() => setPinned((p) => !p)} />
      <IconButton label="Open the gallery" icon={Settings} to="/dev/ui" />
      <IconButton label="Settings" icon={Settings} size="md" onPress={() => undefined} />
    </Example>
  );
}
