import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { appUrl, env } from "@/lib/env";
import { qrSvg } from "@/lib/qr/qr";
import { Reveal } from "@/components/site/reveal";
import { HeroStage } from "@/components/site/hero-stage";
import { ArScene } from "@/components/site/ar-scene";
import { DemoPhone } from "@/components/site/demo-phone";
import { LeadForm } from "@/components/site/lead-form";

export const metadata: Metadata = {
  title: { absolute: "Voir avant de commander — Vos plats en 3D et en réalité augmentée" },
  description:
    "Vos clients découvrent vos plats en 3D et en réalité augmentée, directement sur leur table, avant de commander. Un simple QR code suffit, sans application.",
};

// Rendu à la demande : l'URL publique (QR code de la démo) et les coordonnées viennent de la configuration du serveur.
export const dynamic = "force-dynamic";

const DEMO_PATH = "/menu/demo-futuriste";
const LANGUAGES = ["Français", "English", "Español", "Italiano", "Deutsch", "Português", "العربية", "中文", "日本語"];
const FILM = "/video/film.mp4";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-4 text-[11px] tracking-[.32em] text-ivory/45 uppercase">
      <span className="h-px w-10 bg-ivory/30" aria-hidden="true" />
      {children}
    </p>
  );
}

function Title({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`font-serif text-[40px] leading-[1.04] tracking-[-0.015em] text-balance text-ivory sm:text-[58px] ${className}`}>{children}</h2>;
}

export default async function HomePage() {
  const demoUrl = `${appUrl()}${DEMO_PATH}`;
  const demoQr = await qrSvg(demoUrl, { fg: "#0b0a09", bg: "#f2eee6", margin: 2 });
  const contactEmail = env().CONTACT_EMAIL;
  const contactPhone = env().CONTACT_PHONE;
  const hasFilm = existsSync(path.join(process.cwd(), "public", FILM));

  return (
    <>
      {/* ─── Promesse ────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-36 pb-20 sm:pt-44 lg:min-h-[100svh] lg:pb-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_70%_40%,rgba(242,238,230,.06),transparent)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <Eyebrow>Menu 3D · Réalité augmentée</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="mt-8 font-serif text-[54px] leading-[0.98] tracking-[-0.02em] text-balance text-ivory sm:text-[80px] xl:text-[96px]">
                Le plat, <em className="text-ivory/60">avant</em> l&apos;assiette.
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.7] text-pretty text-ivory/60">
                Vos clients scannent un QR code et découvrent chaque plat en 3D, puis le posent sur leur table en réalité augmentée, à sa taille réelle.
                Sans application.
              </p>
            </Reveal>
            <Reveal delay={300} className="mt-11 flex flex-wrap items-center gap-6">
              <a
                href="#demo"
                className="group inline-flex h-13 items-center gap-3 rounded-full bg-ivory px-7 text-[14.5px] font-medium text-ink transition-transform duration-300 hover:-translate-y-0.5"
              >
                Découvrir la démo <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.6} />
              </a>
              <a href="#contact" className="group inline-flex items-center gap-2 text-[14.5px] text-ivory/75 transition-colors hover:text-ivory">
                Demander une démonstration
                <span className="h-px w-6 bg-ivory/40 transition-all duration-300 group-hover:w-10 group-hover:bg-ivory" aria-hidden="true" />
              </a>
            </Reveal>
          </div>
          <Reveal delay={250}>
            <HeroStage model="/demo/models/greek-house-board.glb" alt="Greek House XXL Board, plat réel scanné en 3D" />
            <p className="-mt-4 text-center text-[11px] tracking-[.28em] text-ivory/35 uppercase">Greek House XXL Board · scan 3D réel</p>
          </Reveal>
        </div>
      </section>

      {/* ─── Film ────────────────────────────────────────────────────────── */}
      {hasFilm ? (
        <section id="film" aria-labelledby="film-title" className="scroll-mt-24 border-t border-white/[.07] py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow>Le film</Eyebrow>
                <h2 id="film-title" className="mt-7 font-serif text-[40px] leading-[1.04] tracking-[-0.015em] text-ivory sm:text-[52px]">
                  Quarante-sept secondes, <em className="text-ivory/55">de la carte à la table.</em>
                </h2>
              </div>
              <p className="text-[12px] tracking-[.24em] text-ivory/35 uppercase">Plats réels · son conseillé</p>
            </Reveal>
            <Reveal delay={120} className="overflow-hidden rounded-[22px] border border-white/[.08] bg-ink-2">
              <video src={FILM} poster="/video/film-poster.jpg" controls playsInline preload="none" className="aspect-video w-full bg-ink" />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ─── L'expérience ────────────────────────────────────────────────── */}
      <section id="experience" className="scroll-mt-24 border-t border-white/[.07] py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <Reveal>
              <Eyebrow>L&apos;expérience</Eyebrow>
              <Title className="mt-7">
                Trois gestes, <em className="text-ivory/55">aucune application.</em>
              </Title>
            </Reveal>
            <Reveal delay={120}>
              <p className="max-w-xl text-[17px] leading-[1.7] text-ivory/55 lg:ms-auto">
                Le client s&apos;installe, scanne le QR code de la table et ouvre un menu soigné, dans sa langue. Chaque plat se découvre sous tous les angles avant
                d&apos;être choisi.
              </p>
            </Reveal>
          </div>
          <ol className="mt-20 grid border-t border-white/[.08] md:grid-cols-3">
            {[
              ["01", "Scanner", "Avec l'appareil photo du téléphone. Le menu s'ouvre instantanément, sans inscription ni téléchargement."],
              ["02", "Explorer", "Photos, descriptions, prix, allergènes — et le plat en 3D, à faire tourner et à approcher du bout du doigt."],
              ["03", "Poser sur la table", "Un geste, et l'assiette apparaît sur la table, en réalité augmentée, à sa taille réelle."],
            ].map(([n, title, text], i) => (
              <Reveal
                as="li"
                key={n}
                delay={i * 120}
                className="border-b border-white/[.08] py-10 md:border-b-0 md:border-s md:px-10 md:py-12 md:first:border-s-0 md:first:ps-0"
              >
                <span className="text-[12px] tracking-[.3em] text-ivory/35">{n}</span>
                <h3 className="mt-8 font-serif text-[34px] leading-none text-ivory">{title}</h3>
                <p className="mt-5 max-w-sm text-[15.5px] leading-[1.7] text-ivory/55">{text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ─── Réalité augmentée ───────────────────────────────────────────── */}
      <section id="realite-augmentee" className="relative scroll-mt-24 overflow-hidden border-t border-white/[.07] py-24 sm:py-36">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Reveal>
              <Eyebrow>Réalité augmentée</Eyebrow>
              <Title className="mt-7">
                Sur la table, <em className="text-ivory/55">à taille réelle.</em>
              </Title>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.7] text-ivory/55">
                Le téléphone repère la table, l&apos;assiette s&apos;y pose. Le client tourne autour, se penche, compare les portions. Il sait exactement ce qu&apos;il
                va recevoir.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[.08] bg-white/[.08] sm:grid-cols-2">
                {[
                  ["iPhone et iPad", "AR Quick Look, intégré à Safari."],
                  ["Android", "Scene Viewer ou WebXR, dans Chrome."],
                  ["Taille réelle", "Mesurée sur le modèle, validée, jamais inventée."],
                  ["Partout ailleurs", "Une visionneuse 3D prend le relais."],
                ].map(([t, d]) => (
                  <div key={t} className="bg-ink p-6">
                    <dt className="text-[14.5px] text-ivory">{t}</dt>
                    <dd className="mt-1.5 text-[14px] leading-relaxed text-ivory/50">{d}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
          <Reveal delay={150}>
            <ArScene background="/demo/photos/interieur.jpg" model="/demo/models/los-amigos-burger.glb" alt="Los Amigos Burger posé sur la table" size="Ø 19,6 cm" />
          </Reveal>
        </div>
      </section>

      {/* ─── Démonstration ───────────────────────────────────────────────── */}
      <section id="demo" className="relative scroll-mt-24 border-t border-white/[.07] py-24 sm:py-36">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <Reveal className="hidden lg:block">
            <DemoPhone src={DEMO_PATH} />
          </Reveal>
          <div>
            <Reveal>
              <Eyebrow>Démonstration</Eyebrow>
              <Title className="mt-7">
                Essayez-le <em className="text-ivory/55">comme vos clients.</em>
              </Title>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.7] text-ivory/55">
                Un vrai menu, avec de vrais plats scannés en 3D. Ouvrez un plat, faites-le tourner, puis posez-le sur votre table depuis votre téléphone.
              </p>
            </Reveal>
            <Reveal delay={200} className="mt-12 flex items-center gap-7">
              <div className="w-36 shrink-0 overflow-hidden rounded-xl" dangerouslySetInnerHTML={{ __html: demoQr }} />
              <div>
                <p className="text-[15px] text-ivory">Scannez avec votre téléphone</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ivory/50">iPhone et Android, sans application.</p>
                <a
                  href={DEMO_PATH}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-5 inline-flex items-center gap-2 text-[14.5px] text-ivory/80 transition-colors hover:text-ivory"
                >
                  Ouvrir la démo <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.6} />
                </a>
              </div>
            </Reveal>
            <Reveal className="mt-10 lg:hidden">
              <Link href={DEMO_PATH} className="flex h-14 items-center justify-center rounded-full bg-ivory text-[15px] font-medium text-ink">
                Ouvrir le menu de démonstration
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── Engagements ─────────────────────────────────────────────────── */}
      <section id="avantages" className="scroll-mt-24 border-t border-white/[.07] py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal className="max-w-3xl">
            <Eyebrow>Pour les restaurateurs</Eyebrow>
            <Title className="mt-7">
              Donner envie, <em className="text-ivory/55">avant la première bouchée.</em>
            </Title>
          </Reveal>
          <div className="mt-20 grid gap-x-16 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Le travail de la cuisine, enfin visible", "Chaque assiette se découvre en 3D, comme si elle était déjà servie."],
              ["Un choix en confiance", "Portions, dressage, accompagnements : le client voit ce qu'il commande."],
              ["Les suggestions qui comptent", "Desserts, boissons, accompagnements mis en avant par des recommandations que vous choisissez."],
              ["Neuf langues", "Détection automatique de la langue du téléphone. Les prix ne sont jamais modifiés par la traduction."],
              ["Allergènes clairs", "Affichés sur chaque fiche. Rien n'est indiqué qui n'ait été renseigné."],
              ["Mesurer, sans promettre", "Consultations, plats regardés en 3D, ouvertures en réalité augmentée : des compteurs anonymes, sans cookie."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={(i % 3) * 100} className="border-t border-white/[.1] pt-7">
                <h3 className="text-[17px] leading-snug text-ivory">{t}</h3>
                <p className="mt-3 text-[15px] leading-[1.7] text-ivory/50">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Langues ─────────────────────────────────────────────────────── */}
      <section aria-label="Langues proposées" className="border-y border-white/[.07] py-10">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
          <div className="flex w-max animate-[marquee_60s_linear_infinite] gap-16 pe-16 motion-reduce:animate-none">
            {[...LANGUAGES, ...LANGUAGES].map((l, i) => (
              <span key={i} className="font-serif text-[34px] whitespace-nowrap text-ivory/30 italic">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Méthode ─────────────────────────────────────────────────────── */}
      <section id="methode" className="scroll-mt-24 py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <Eyebrow>Méthode</Eyebrow>
              <Title className="mt-7">
                Nous nous occupons <em className="text-ivory/55">de tout.</em>
              </Title>
              <p className="mt-8 max-w-md text-[17px] leading-[1.7] text-ivory/55">
                Rien à installer, rien à gérer techniquement. Vous gardez la main sur votre carte, à tout moment.
              </p>
            </Reveal>
            <ol className="divide-y divide-white/[.08] border-y border-white/[.08]">
              {[
                ["Vos plats sont scannés en 3D", "Chaque plat est capturé puis préparé pour iPhone et Android. Les modèles sont allégés pour s'ouvrir vite, même en 4G."],
                ["Votre menu prend forme", "Votre carte est importée, traduite, et chaque plat associé à sa photo et à son modèle. Vous validez tout avant la mise en ligne."],
                ["Vos clients scannent", "Le QR code se pose sur vos tables. Un prix change, un plat est épuisé : vous le modifiez en un clic, le QR code ne change jamais."],
              ].map(([t, d], i) => (
                <Reveal as="li" key={t} delay={i * 120} className="grid grid-cols-[3rem_1fr] gap-4 py-9">
                  <span className="pt-1 font-serif text-[22px] text-ivory/40 italic">{i + 1}</span>
                  <div>
                    <h3 className="text-[19px] text-ivory">{t}</h3>
                    <p className="mt-3 text-[15px] leading-[1.7] text-ivory/50">{d}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ─── Questions ───────────────────────────────────────────────────── */}
      <section id="questions" className="scroll-mt-24 border-t border-white/[.07] py-24 sm:py-36">
        <div className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <Title className="mt-7">Ce que l&apos;on nous demande.</Title>
          </Reveal>
          <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
            {[
              ["Mes clients doivent-ils installer une application ?", "Non. Le menu s'ouvre dans le navigateur du téléphone après avoir scanné le QR code avec l'appareil photo."],
              ["Quels téléphones sont compatibles ?", "Les iPhone et iPad récents (AR Quick Look) et la plupart des Android récents compatibles ARCore (Scene Viewer ou WebXR dans Chrome). Ailleurs, le plat reste visible en 3D interactive."],
              ["Si je change un prix ou un plat ?", "La modification se fait dans un brouillon, puis se publie en un clic. Le QR code reste le même : inutile de réimprimer."],
              ["Dans quelles langues ?", "Français, anglais, espagnol, italien, allemand, portugais, arabe, chinois et japonais, avec détection automatique. Les traductions sont relues et corrigeables."],
              ["Tous mes plats doivent-ils être en 3D ?", "Non. Les plats sans modèle 3D s'affichent avec leur photo et leur description. Vous pouvez commencer par vos plats signatures."],
              ["Mes clients sont-ils suivis ?", "Non. Uniquement des compteurs anonymes, sans cookie ni donnée personnelle."],
            ].map(([q, a]) => (
              <details key={q} className="group py-7 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[17px] text-ivory">
                  {q}
                  <span className="relative size-4 shrink-0" aria-hidden="true">
                    <span className="absolute inset-x-0 top-1/2 h-px bg-ivory/60" />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-ivory/60 transition-transform duration-300 group-open:scale-y-0" />
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-[15.5px] leading-[1.7] text-ivory/50">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Contact ─────────────────────────────────────────────────────── */}
      <section id="contact" className="scroll-mt-24 border-t border-white/[.07] py-24 sm:py-36">
        <div id="demande-demo" className="mx-auto grid max-w-7xl gap-16 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Reveal>
              <Eyebrow>Contact</Eyebrow>
              <Title className="mt-7">
                Voyons votre carte <em className="text-ivory/55">en 3D.</em>
              </Title>
              <p className="mt-8 max-w-md text-[17px] leading-[1.7] text-ivory/55">
                Laissez-nous vos coordonnées : nous vous présentons l&apos;expérience sur votre propre téléphone, avec vos plats.
              </p>
            </Reveal>
            <Reveal delay={120} className="mt-10 space-y-2 text-[15px] text-ivory/60">
              {contactEmail ? (
                <p>
                  <a href={`mailto:${contactEmail}`} className="text-ivory transition-colors hover:text-ivory/70">
                    {contactEmail}
                  </a>
                </p>
              ) : null}
              {contactPhone ? (
                <p>
                  <a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`} className="text-ivory transition-colors hover:text-ivory/70">
                    {contactPhone}
                  </a>
                </p>
              ) : null}
            </Reveal>
          </div>
          <Reveal delay={150}>
            <LeadForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
