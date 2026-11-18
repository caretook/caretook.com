import type { ProviderType } from "@caretook/data/schema";
import type { LucideIcon } from "lucide-react";

import { Building2, Pill, Stethoscope, UserRound } from "lucide-react";

export const PROVIDER_TYPE_ICONS: Record<ProviderType, LucideIcon> = {
  clinician: Stethoscope,
  practice: Building2,
  pharmacy: Pill,
  other: UserRound,
};

/** A provider's type as a round icon (decorative: the type is also written out beside it). */
export function ProviderTypeIcon({
  type,
  past = false,
  className = "size-9",
}: {
  type: ProviderType;
  past?: boolean;
  className?: string;
}) {
  const Icon = PROVIDER_TYPE_ICONS[type];
  return (
    <span
      aria-hidden="true"
      className={`bg-base-200 text-base-content grid shrink-0 place-items-center rounded-full ${className} ${past ? "opacity-60" : ""}`}
    >
      <Icon className="size-4" />
    </span>
  );
}
