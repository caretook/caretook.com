// Initials for avatars: the timeline's author circles, the entry header's
// editors, and the user menu. Pure, so `web:unit` tests it.

/** "Maria Lopez" → "ML", "Maria" → "M", up to two words. "?" when there's nothing to use. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

/** A user's initials: from their name, else the first letter of their email, else "?". */
export const userInitials = ({ name, email }: { name?: string | null; email?: string | null }) => {
  if (name?.trim()) return initials(name);
  const first = email?.trim()[0];
  return first ? first.toUpperCase() : "?";
};
