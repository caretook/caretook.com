import {
  Ban,
  Bot,
  Clock,
  EyeOff,
  HeartPulse,
  NotebookPen,
  Pill,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Trash,
  UserPlus,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons content modules may name. Content stays plain data (strings), so a
 * copy edit never imports a component; a new icon is one entry here.
 */
export const MARKETING_ICONS = {
  timeline: Clock,
  notes: NotebookPen,
  vitals: HeartPulse,
  family: Users,
  invite: UserPlus,
  phone: Smartphone,
  noAds: Ban,
  notSold: ShieldCheck,
  noTrackers: EyeOff,
  noAiTraining: Bot,
  delete: Trash,
  offline: WifiOff,
  medications: Pill,
  providers: Stethoscope,
} as const satisfies Record<string, LucideIcon>;

export type MarketingIconName = keyof typeof MARKETING_ICONS;

export function MarketingIcon({ name, className }: { name: MarketingIconName; className?: string }) {
  const Icon = MARKETING_ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
