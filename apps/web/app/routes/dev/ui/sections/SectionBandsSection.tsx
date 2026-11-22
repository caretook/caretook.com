import { Plus } from "lucide-react";
import { Button, DetailHeader, Page, Section } from "~/components/ui";
import { Example } from "../Example";

/** A part that renders nothing (empty, or hidden by role): it leaves no band. */
function Hidden() {
  return null;
}

export function SectionBandsSection() {
  return (
    <Example label="A banded page: the header band, then each part a Section; the bands alternate, a hidden part leaves none">
      <div className="border-base-300 w-full overflow-hidden rounded-box border">
        <Page bands aria-label="Banded page">
          <Section>
            <DetailHeader title="Lisinopril 10 mg" details="Tablet · 1 tablet" />
          </Section>
          <Section title="Details">
            <p className="text-sm">Once every morning, with water.</p>
          </Section>
          <Hidden />
          <Section
            title="Todos"
            actions={
              <Button variant="ghost" size="sm" icon={Plus}>
                Add todo
              </Button>
            }
          >
            <p className="text-muted text-sm">Ask about the refill at the next visit.</p>
          </Section>
          <Section title="Notes" description="Shared with the care group.">
            <p className="text-sm">Take with food.</p>
          </Section>
        </Page>
      </div>
    </Example>
  );
}
