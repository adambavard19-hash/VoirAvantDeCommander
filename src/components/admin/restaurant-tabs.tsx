"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export function RestaurantTabs({ restaurantId }: { restaurantId: string }) {
  const pathname = usePathname();
  const base = `/admin/restaurants/${restaurantId}`;
  const tabs = [
    { href: base, label: "Vue d'ensemble", exact: true },
    { href: `${base}/menu`, label: "Menu" },
    { href: `${base}/import`, label: "Import intelligent" },
    { href: `${base}/translations`, label: "Traductions" },
    { href: `${base}/qr`, label: "QR code" },
    { href: `${base}/settings`, label: "Paramètres" },
  ];
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 sm:mx-0 sm:px-0" aria-label="Sections du restaurant">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-[14px] font-medium whitespace-nowrap transition",
              active ? "text-stone-900" : "text-stone-500 hover:text-stone-800",
            )}
          >
            {t.label}
            {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
