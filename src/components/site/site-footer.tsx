import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[.07] bg-ink">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <BrandLogo />
          <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-ivory/45">
            Menus numériques en 3D et en réalité augmentée pour les restaurants. Vos clients découvrent vos plats avant de commander.
          </p>
        </div>
        <nav aria-label="Produit" className="space-y-3 text-[14px]">
          <p className="mb-4 text-[11px] tracking-[.28em] text-ivory/35 uppercase">Produit</p>
          <Link href="/#experience" className="block text-ivory/65 transition-colors hover:text-ivory">L&apos;expérience</Link>
          <Link href="/#realite-augmentee" className="block text-ivory/65 transition-colors hover:text-ivory">Réalité augmentée</Link>
          <Link href="/#demo" className="block text-ivory/65 transition-colors hover:text-ivory">Démonstration</Link>
          <Link href="/#questions" className="block text-ivory/65 transition-colors hover:text-ivory">Questions fréquentes</Link>
        </nav>
        <nav aria-label="Informations" className="space-y-3 text-[14px]">
          <p className="mb-4 text-[11px] tracking-[.28em] text-ivory/35 uppercase">Informations</p>
          <Link href="/#contact" className="block text-ivory/65 transition-colors hover:text-ivory">Contact</Link>
          <Link href="/mentions-legales" className="block text-ivory/65 transition-colors hover:text-ivory">Mentions légales</Link>
          <Link href="/confidentialite" className="block text-ivory/65 transition-colors hover:text-ivory">Confidentialité</Link>
          <Link href="/admin/login" className="block text-ivory/65 transition-colors hover:text-ivory">Espace restaurateur</Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/[.07] px-5 py-7 text-[12px] tracking-wide text-ivory/35 sm:px-8">
        <span>© {new Date().getFullYear()} Voir avant de commander</span>
        <span>Conçu pour la restauration</span>
      </div>
    </footer>
  );
}
