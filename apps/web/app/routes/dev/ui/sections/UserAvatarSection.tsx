import { UserAvatar } from "~/components/ui";
import { Example } from "../Example";

export function UserAvatarSection() {
  return (
    <Example label="Initials, at each size">
      <UserAvatar name="Rosa Delgado" size="xs" />
      <UserAvatar name="Rosa Delgado" size="sm" />
      <UserAvatar name="Sam Park" size="md" />
      <UserAvatar email="jo@example.com" size="lg" />
    </Example>
  );
}
