import { AvatarStack } from "~/components/ui";
import { Example } from "../Example";

const PEOPLE = [
  { id: "1", name: "Rosa Delgado" },
  { id: "2", name: "Sam Park" },
  { id: "3", name: "Jo Rivera" },
  { id: "4", name: "Ana Lima" },
  { id: "5", email: "kit@example.com" },
];

export function AvatarStackSection() {
  return (
    <Example label="Overlapping, with a count past the max">
      <AvatarStack label="Editing now" people={PEOPLE.slice(0, 2)} />
      <AvatarStack label="Members" people={PEOPLE} max={3} />
    </Example>
  );
}
