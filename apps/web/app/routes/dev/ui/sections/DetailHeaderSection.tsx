import { ListTodo, Pencil, Pill, Stethoscope } from "lucide-react";
import { Badge, Button, DetailHeader, STATUS_TONE, UserAvatar, ViaTag } from "~/components/ui";
import { Example } from "../Example";

export function DetailHeaderSection() {
  const edit = (
    <Button variant="ghost" size="sm" icon={Pencil}>
      Edit
    </Button>
  );
  return (
    <>
      <Example label="A current medication: icon, title, details, actions">
        <DetailHeader
          className="w-full"
          icon={Pill}
          title="Metformin 500 mg"
          details="Tablet · 1 with breakfast"
          actions={edit}
        />
      </Example>
      <Example label="Stopped (the muted tone, a status badge)">
        <DetailHeader
          className="w-full"
          icon={Pill}
          tone="muted"
          title="Oxybutynin 5 mg"
          badges={<Badge tone={STATUS_TONE.past}>Discontinued</Badge>}
          details="Tablet"
          actions={edit}
        />
      </Example>
      <Example label="A provider (the neutral tone), with badges and editors">
        <DetailHeader
          className="w-full"
          icon={Stethoscope}
          tone="neutral"
          title="Dr. Mira Lark"
          badges={<Badge tone={STATUS_TONE.current}>Primary</Badge>}
          details="Clinician · Cardiology"
          editors={<UserAvatar name="Sam Okafor" size="sm" />}
          actions={edit}
        />
      </Example>
      <Example label="No details: an overdue to-do added through an assistant">
        <DetailHeader
          className="w-full"
          icon={ListTodo}
          title="Pick up the prescription"
          badges={
            <>
              <Badge tone={STATUS_TONE.overdue}>Overdue</Badge>
              <ViaTag via="Claude" />
            </>
          }
        />
      </Example>
      <Example label="A leading avatar instead of an icon">
        <DetailHeader
          className="w-full"
          media={<UserAvatar name="Margaret Jones" size="lg" />}
          title="Margaret Jones"
          details="Born Mar 3, 1941 · 85"
        />
      </Example>
    </>
  );
}
