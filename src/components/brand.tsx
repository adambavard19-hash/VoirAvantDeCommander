import { cn } from "@/components/ui/cn";

/**
 * Logo VoirAvantDeCommander : une assiette posée sur la ligne de la table (le plat
 * apparaît là où il sera servi). Monochrome : il prend la couleur du texte.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" fill="none" stroke="currentColor">
      <circle cx="20" cy="17" r="10.5" strokeWidth="1.4" />
      <circle cx="20" cy="17" r="6" strokeWidth="1" opacity=".55" />
      <path d="M5 31.5h30" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 35.5h18" strokeWidth="1" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

export function BrandLogo({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", tone === "light" ? "text-ivory" : "text-stone-900", className)}>
      <BrandMark className="size-7 shrink-0" />
      <span className="font-serif text-[21px] leading-none tracking-[-0.01em]">
        Voir avant de commander
      </span>
    </span>
  );
}
