import { BadgeCheck, Flame, House, Leaf, MapPin, Sparkles, Sprout, Star, WheatOff, type LucideIcon } from "lucide-react";

const TAG_ICONS: Record<string, LucideIcon> = {
  signature: Star,
  new: Sparkles,
  homemade: House,
  vegetarian: Leaf,
  vegan: Sprout,
  gluten_free: WheatOff,
  spicy: Flame,
  halal: BadgeCheck,
  local: MapPin,
};

export function TagIcon({ code, className }: { code: string; className?: string }) {
  const Icon = TAG_ICONS[code] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" strokeWidth={2} />;
}
