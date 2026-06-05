import {
  Box,
  CalendarDays,
  EyeOff,
  Flag,
  GitBranch,
  Heart,
  HelpCircle,
  Key,
  Link,
  LucideIcon,
  MapPin,
  ScrollText,
  Sparkles,
  StickyNote,
  Swords,
  Users
} from "lucide-react";

export const iconOptions = [
  { value: "users", label: "People" },
  { value: "sticky-note", label: "Note" },
  { value: "map-pin", label: "Place" },
  { value: "calendar-days", label: "Event" },
  { value: "box", label: "Object" },
  { value: "flag", label: "Faction" },
  { value: "sparkles", label: "Custom" },
  { value: "link", label: "Link" },
  { value: "eye-off", label: "Secret" },
  { value: "heart", label: "Heart" },
  { value: "swords", label: "Conflict" },
  { value: "key", label: "Key" },
  { value: "git-branch", label: "Cause" },
  { value: "scroll-text", label: "Lore" }
];

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  "sticky-note": StickyNote,
  "map-pin": MapPin,
  "calendar-days": CalendarDays,
  box: Box,
  flag: Flag,
  sparkles: Sparkles,
  link: Link,
  "eye-off": EyeOff,
  heart: Heart,
  swords: Swords,
  key: Key,
  "git-branch": GitBranch,
  "scroll-text": ScrollText
};

export function iconForName(icon: string): LucideIcon {
  return iconMap[icon] ?? HelpCircle;
}
