import type { LucideIcon } from "lucide-react";
import type { Accent } from "~/components/ui/accents";

import { MapPin } from "lucide-react";
import { GROUP_SECTIONS } from "./groupSections";

/** The sections that carry a colour. Care periods isn't in `GROUP_SECTIONS`, so this is a map of its own. */
export const ACCENTED_SECTIONS = ["timeline", "medications", "planner", "providers", "periods"] as const;
export type AccentedSection = (typeof ACCENTED_SECTIONS)[number];

export type SectionAccent = { accent: Accent; icon: LucideIcon };

const registryIcon = (id: string) => {
  const section = GROUP_SECTIONS.find((s) => s.id === id);
  if (!section) throw new Error(`No group section "${id}"`);
  return section.icon;
};

const SECTION_ACCENTS: Record<AccentedSection, SectionAccent> = {
  timeline: { accent: "indigo", icon: registryIcon("timeline") },
  medications: { accent: "teal", icon: registryIcon("medications") },
  planner: { accent: "orange", icon: registryIcon("planner") },
  providers: { accent: "lime", icon: registryIcon("providers") },
  // Where care has been; the timeline already has the clock-history icon.
  periods: { accent: "plum", icon: MapPin },
};

/** A section's colour and icon; nothing in Easy mode, which stays neutral. */
export const sectionAccent = (section: AccentedSection, { easy }: { easy: boolean }) =>
  easy ? undefined : SECTION_ACCENTS[section];
