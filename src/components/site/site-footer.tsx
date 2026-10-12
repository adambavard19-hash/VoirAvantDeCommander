import Link from "next/link";
import { BrandLogo } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/8 bg-[#050508]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <BrandLogo />
          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/50">
            Menus numériques en 3D et en réalité augmentée pour les restaurants. Vos clients découvrent vos plats avant de commander.
          </p>
        </div>
        <nav aria-label="Produit" className="space-y-2.5 text-[14px]">
          <p className="mb-3 text-[12px] font-semibold tracking-[.18em] text-white/40 uppercase">Produit</p>
          <Link href="/#demo" className="block text-white/70 hover:text-white">Démonstration</Link>
          <Link href="/#realite-augmentee" className="block text-white/70 hover:text-white">Réalité augmentée</Link>
          <Link href="/#fonctionnement" className="block text-white/70 hover:text-white">Fonctionnement</Link>
          <Link href="/#faq" className="block text-white/70 hover:text-white">Questions fréquentes</Link>
        </nav>
        <nav aria-label="Informations" className="space-y-2.5 text-[14px]">
          <p className="mb-3 text-[12px] font-semibold tracking-[.18em] text-white/40 uppercase">Informations</p>
          <Link href="/#contact" className="block text-white/70 hover:text-white">Contact</Link>
          <Link href="/mentions-legales" className="block text-white/70 hover:text-white">Mentions légales</Link>
          <Link href="/confidentialite" className="block text-white/70 hover:text-white">Confidentialité</Link>
          <Link href="/admin/login" className="block text-white/70 hover:text-white">Espace administration</Link>
        </nav>
      </div>
      <div className="border-t border-white/8 px-5 py-6 text-center text-[12.5px] text-white/35">© {new Date().getFullYear()} VoirAvantDeCommander</div>
    </footer>
  );
}
