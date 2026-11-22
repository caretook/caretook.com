import { Star } from "lucide-react";
import { Badge, STATUS_TONE } from "~/components/ui";
import { Example } from "../Example";

export function BadgeSection() {
  return (
    <>
      <Example label="Tones">
        <Badge>Neutral</Badge>
        <Badge tone="primary">Primary</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="info">Info</Badge>
      </Example>
      <Example label="Statuses (the tones table)">
        <Badge tone={STATUS_TONE.current}>Now</Badge>
        <Badge tone={STATUS_TONE.past}>Past</Badge>
        <Badge tone={STATUS_TONE.past}>Stopped</Badge>
        <Badge tone={STATUS_TONE.overdue}>Overdue</Badge>
        <Badge tone={STATUS_TONE.dueSoon}>Due soon</Badge>
        <Badge tone={STATUS_TONE.done}>Done</Badge>
      </Example>
      <Example label="With an icon">
        <Badge tone="primary" icon={Star}>
          Primary contact
        </Badge>
      </Example>
    </>
  );
}
