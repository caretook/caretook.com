import type { StaffCapability } from "@caretook/data/schema";

import { adminUrls } from "./adminUrls";

// /admin's sections, in nav order (admin PRD): each with the capability it
// needs, so the nav shows a staff member only what they may open. A section
// whose screens aren't built yet has `built: false` and stays out of the nav;
// the slice that builds it flips that and adds its route. Pure, tested.

export type AdminSection = {
  id: string;
  label: string;
  path: () => string;
  capability: StaffCapability;
  built: boolean;
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    id: "users",
    label: "Users",
    path: () => adminUrls.users(),
    capability: "users.read",
    built: true,
  },
  {
    id: "groups",
    label: "Groups",
    path: () => adminUrls.groups(),
    capability: "groups.read",
    built: false,
  },
  {
    id: "access-codes",
    label: "Access codes",
    path: () => adminUrls.accessCodes(),
    capability: "accessCodes.write",
    built: true,
  },
  {
    id: "new-group",
    label: "New group",
    path: () => adminUrls.newGroup(),
    capability: "staffGroups.create",
    built: true,
  },
  {
    id: "waitlist",
    label: "Waitlist",
    path: () => adminUrls.waitlist(),
    capability: "waitlist.read",
    built: true,
  },
  {
    id: "audit",
    label: "Audit",
    path: () => adminUrls.audit(),
    capability: "audit.read",
    built: true,
  },
  {
    id: "settings",
    label: "Settings",
    path: () => adminUrls.settings(),
    capability: "settings.read",
    built: false,
  },
];

/** The sections a staff member with `capabilities` sees, in nav order. */
export const adminSections = (capabilities: readonly StaffCapability[]) =>
  ADMIN_SECTIONS.filter((section) => section.built && capabilities.includes(section.capability));

/** Where /admin opens: the first section they see (null when there's none). */
export const adminStartPath = (capabilities: readonly StaffCapability[]) =>
  adminSections(capabilities)[0]?.path() ?? null;
