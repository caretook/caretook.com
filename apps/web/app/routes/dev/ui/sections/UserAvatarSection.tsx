import { UserAvatar } from "~/components/ui";
import { Example } from "../Example";

export function UserAvatarSection() {
  return (
    <>
      <Example label="Initials, at each size">
        <UserAvatar name="Rosa Delgado" size="xs" />
        <UserAvatar name="Rosa Delgado" size="sm" />
        <UserAvatar name="Sam Park" size="md" />
        <UserAvatar email="jo@example.com" size="lg" />
      </Example>
      <Example label="A chosen color, icon, or both">
        <UserAvatar name="Rosa Delgado" size="lg" look={{ color: "jade" }} />
        <UserAvatar name="Sam Park" size="lg" look={{ icon: "bird" }} />
        <UserAvatar name="Jo Lind" size="lg" look={{ color: "violet", icon: "moon" }} />
      </Example>
    </>
  );
}
