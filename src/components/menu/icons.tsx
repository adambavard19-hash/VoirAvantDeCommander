import {
  Baby,
  Beef,
  Beer,
  BookOpen,
  CakeSlice,
  Carrot,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  IceCreamCone,
  Leaf,
  Martini,
  Pizza,
  Salad,
  Sandwich,
  Shell,
  Soup,
  Sparkles,
  Utensils,
  Wine,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  salad: Salad,
  soup: Soup,
  utensils: Utensils,
  beef: Beef,
  drumstick: Drumstick,
  fish: Fish,
  shell: Shell,
  sandwich: Sandwich,
  pizza: Pizza,
  carrot: Carrot,
  cake: CakeSlice,
  "ice-cream": IceCreamCone,
  cookie: Cookie,
  wine: Wine,
  beer: Beer,
  martini: Martini,
  coffee: Coffee,
  cup: CupSoda,
  croissant: Croissant,
  egg: Egg,
  leaf: Leaf,
  menu: BookOpen,
  sparkles: Sparkles,
  baby: Baby,
};

export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && ICONS[name]) || Utensils;
  return <Icon className={className} aria-hidden="true" strokeWidth={1.75} />;
}

/** Pictogramme « réalité augmentée » : un cube posé sur un plan. */
export function ArIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 3.2 18.5 7v7.4L12 18.2 5.5 14.4V7L12 3.2Z" />
      <path d="M5.5 7 12 10.8 18.5 7M12 10.8v7.4" />
      <path d="M3 17.5 1.8 18.2 12 22.2l10.2-4-1.2-.7" opacity=".55" />
    </svg>
  );
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
