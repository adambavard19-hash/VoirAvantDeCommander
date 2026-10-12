import { cn } from "@/components/ui/cn";

/** Logo VoirAvantDeCommander : un plat posé dans un cube de réalité augmentée. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="vadc-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFB547" />
          <stop offset=".55" stopColor="#FF6A3D" />
          <stop offset="1" stopColor="#9B7BFF" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#vadc-g)" />
      <path d="M20 8.5 30 14.2v11.6L20 31.5 10 25.8V14.2L20 8.5Z" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" opacity=".95" />
      <path d="M10 14.2 20 20l10-5.8M20 20v11.5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" opacity=".55" />
      <ellipse cx="20" cy="20.3" rx="5.4" ry="2.4" fill="#fff" />
      <path d="M16.6 19.6c.6-2.3 6.2-2.3 6.8 0" fill="none" stroke="#FF6A3D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="size-8 shrink-0" />
      <span className={cn("font-display text-[16px] font-semibold tracking-tight", tone === "light" ? "text-white" : "text-stone-900")}>
        Voir<span className="text-saffron">Avant</span>DeCommander
      </span>
    </span>
  );
}
