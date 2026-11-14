"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/components/ui/cn";

const LINKS = [
  { href: "/#experience", label: "L'expérience" },
  { href: "/#realite-augmentee", label: "Réalité augmentée" },
  { href: "/#demo", label: "Démo" },
  { href: "/#methode", label: "Méthode" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-700",
        scrolled ? "border-b border-white/[.06] bg-ink/80 py-3.5 backdrop-blur-xl" : "border-b border-transparent py-6",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Voir avant de commander — accueil">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[13.5px] tracking-wide text-ivory/60 transition-colors duration-300 hover:text-ivory">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-5 lg:flex">
          <Link href="/admin/login" className="text-[13.5px] text-ivory/60 transition-colors hover:text-ivory">
            Connexion
          </Link>
          <Link
            href="/#contact"
            className="rounded-full border border-ivory/25 px-5 py-2.5 text-[13.5px] text-ivory transition-colors duration-300 hover:border-ivory hover:bg-ivory hover:text-ink"
          >
            Demander une démo
          </Link>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center text-ivory lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" strokeWidth={1.5} />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 animate-[fade-in_.3s_ease-out] bg-ink lg:hidden">
          <div className="flex items-center justify-between px-5 py-6">
            <BrandLogo />
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center text-ivory" aria-label="Fermer le menu">
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </div>
          <nav className="flex flex-col px-5 pt-8" aria-label="Navigation mobile">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-white/[.08] py-5 font-serif text-[34px] text-ivory">
                {l.label}
              </a>
            ))}
            <Link href="/admin/login" className="py-5 text-[15px] text-ivory/55">
              Connexion
            </Link>
            <Link href="/#contact" onClick={() => setOpen(false)} className="mt-4 rounded-full bg-ivory px-6 py-4 text-center text-[15px] font-medium text-ink">
              Demander une démo
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
