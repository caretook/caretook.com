import { Button, Card } from "~/components/ui";
import { Example } from "../Example";

export function CardSection() {
  return (
    <>
      <Example label="Titled (a named region)">
        <Card id="gallery-reminders" title="Reminders" className="w-full">
          <p className="text-muted text-sm">We email you the evening before and an hour before.</p>
        </Card>
      </Example>
      <Example label="With actions beside the title">
        <Card
          id="gallery-pharmacy"
          title="Corner Pharmacy"
          actions={<Button size="sm">Edit</Button>}
          className="w-full"
        >
          <p className="text-sm">12 Elm Street · Open until 8 pm</p>
        </Card>
      </Example>
      <Example label="Untitled">
        <Card className="w-full">
          <p className="text-sm">A plain surface on the page.</p>
        </Card>
      </Example>
    </>
  );
}
