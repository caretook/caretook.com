import { Monitor, Smartphone } from "lucide-react";
import { Badge, Button, List, ListRow } from "~/components/ui";
import { Example } from "../Example";

export function ListSection() {
  return (
    <>
      <Example label="Plain rows, with a trailing control">
        <List label="Devices" className="w-full">
          <ListRow trailing={<Badge tone="primary">This device</Badge>}>
            <div className="flex items-center gap-3">
              <Monitor aria-hidden="true" className="text-muted size-5 shrink-0" />
              <p className="font-medium">Firefox on a Mac</p>
            </div>
          </ListRow>
          <ListRow trailing={<Button size="sm">Sign out</Button>}>
            <div className="flex items-center gap-3">
              <Smartphone aria-hidden="true" className="text-muted size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Safari on an iPhone</p>
                <p className="text-muted text-sm">Last active 2 days ago</p>
              </div>
            </div>
          </ListRow>
        </List>
      </Example>
      <Example label="Link rows (the whole row is the link)">
        <List label="Providers" className="w-full">
          <ListRow to="/dev/ui" trailing={<Button size="sm">Call</Button>}>
            <p className="font-medium">Dr. Lena Ortiz</p>
            <p className="text-muted text-sm">Cardiology</p>
          </ListRow>
          <ListRow to="/dev/ui">
            <p className="font-medium">Corner Pharmacy</p>
            <p className="text-muted text-sm">Pharmacy</p>
          </ListRow>
        </List>
      </Example>
    </>
  );
}
