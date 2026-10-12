"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand";
import { cn } from "@/components/ui/cn";

const LINKS = [
  { href: "/#concept", label: "Concept" },
  { href: "/#demo", label: "Démo" },
  { href: "/#realite-augmentee", label: "Réalité augmentée" },
  { href: "/#avantages", label: "Avantages" },
  { href: "/#fonctionnement", label: "Fonctionnement" },
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
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-500", scrolled ? "bg-ink/70 py-3 shadow-[0_1px_0_rgba(255,255,255,.06)] backdrop-blur-xl" : "py-5")}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="VoirAvantDeCommander — accueil">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[14px] text-white/70 transition hover:bg-white/5 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/admin/login" className="rounded-full px-4 py-2 text-[14px] text-white/70 transition hover:text-white">
            Connexion
          </Link>
          <Link href="/#demande-demo" className="rounded-full bg-saffron px-5 py-2.5 text-[14px] font-semibold text-ink shadow-[0_8px_30px_-8px_rgba(255,181,71,.6)] transition hover:brightness-105">
            Demander une démo
          </Link>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full bg-white/5 text-white lg:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-5 py-5">
            <BrandLogo />
            <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full bg-white/5 text-white" aria-label="Fermer le menu">
              <X className="size-5" />
            </button>
          </div>
          <nav className="flex flex-col gap-1 px-5 pt-6" aria-label="Navigation mobile">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-4 font-display text-2xl text-white">
                {l.label}
              </a>
            ))}
            <Link href="/admin/login" className="rounded-2xl px-4 py-4 text-lg text-white/60">
              Connexion administrateur
            </Link>
            <Link href="/#demande-demo" onClick={() => setOpen(false)} className="mt-4 rounded-full bg-saffron px-6 py-4 text-center text-lg font-semibold text-ink">
              Demander une démo
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
