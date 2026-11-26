import {
  Ban,
  Bot,
  CalendarClock,
  CalendarDays,
  Clock,
  EyeOff,
  HeartPulse,
  IdCard,
  ListTodo,
  MapPin,
  NotebookPen,
  Pill,
  Plug,
  Printer,
  Search,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Trash,
  UserPlus,
  Users,
  WifiOff,
  Zap,
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
  quickEntry: Zap,
  todos: ListTodo,
  planner: CalendarClock,
  calendars: CalendarDays,
  print: Printer,
  carePeriods: MapPin,
  search: Search,
  profile: IdCard,
  assistant: Plug,
} as const satisfies Record<string, LucideIcon>;

export type MarketingIconName = keyof typeof MARKETING_ICONS;

export function MarketingIcon({ name, className }: { name: MarketingIconName; className?: string }) {
  const Icon = MARKETING_ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
