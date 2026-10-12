import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Box,
  CakeSlice,
  Globe2,
  Hand,
  Languages,
  Layers,
  MonitorSmartphone,
  Palette,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  ToggleLeft,
  UtensilsCrossed,
  Wand2,
  Wheat,
} from "lucide-react";
import { appUrl, env } from "@/lib/env";
import { qrSvg } from "@/lib/qr/qr";
import { Reveal } from "@/components/site/reveal";
import { HeroStage } from "@/components/site/hero-stage";
import { DemoPhone } from "@/components/site/demo-phone";
import { LeadForm } from "@/components/site/lead-form";
import { ArIcon } from "@/components/menu/icons";

export const metadata: Metadata = {
  title: { absolute: "VoirAvantDeCommander — Vos plats en 3D et en réalité augmentée" },
  description:
    "Vos clients ne lisent plus seulement votre menu : ils découvrent vos plats en 3D et en réalité augmentée, directement sur leur table. Un simple QR code suffit.",
};

// Rendu à la demande : l'URL publique (QR code de la démo) et les coordonnées viennent de la configuration du serveur.
export const dynamic = "force-dynamic";

const LANGUAGES = ["Français", "English", "Español", "Italiano", "Deutsch", "Português", "العربية", "中文", "日本語"];

function SectionTitle({ eyebrow, title, intro, center }: { eyebrow: string; title: React.ReactNode; intro?: React.ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-[12.5px] font-semibold tracking-[.24em] text-saffron uppercase">{eyebrow}</p>
      <h2 className="mt-4 font-display text-[34px] leading-[1.08] font-semibold tracking-tight text-balance sm:text-[48px]">{title}</h2>
      {intro ? <p className="mt-5 text-[17px] leading-relaxed text-pretty text-white/60">{intro}</p> : null}
    </Reveal>
  );
}

export default async function HomePage() {
  const demoUrl = `${appUrl()}/menu/demo`;
  const demoQr = await qrSvg(demoUrl, { fg: "#08080c", bg: "#ffffff", margin: 2 });
  const contactEmail = env().CONTACT_EMAIL;
  const contactPhone = env().CONTACT_PHONE;

  return (
    <>
      {/* ─── Accueil ─────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-32 pb-16 sm:pt-40 lg:pb-28">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-[10%] h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,.18),transparent)]" />
          <div className="absolute top-40 right-[-10%] h-[700px] w-[700px] rounded-full bg-[radial-gradient(closest-side,rgba(155,123,255,.16),transparent)]" />
          <div className="absolute inset-x-0 bottom-0 h-[420px] [background:linear-gradient(transparent,rgba(8,8,12,1)),repeating-linear-gradient(90deg,rgba(255,255,255,.05)_0_1px,transparent_1px_80px),repeating-linear-gradient(0deg,rgba(255,255,255,.05)_0_1px,transparent_1px_80px)] [mask-image:linear-gradient(transparent,black_40%)] [transform:perspective(700px)_rotateX(62deg)] origin-bottom" />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 py-1.5 ps-1.5 pe-4 text-[13px] text-white/75 backdrop-blur">
                <span className="grid size-6 place-items-center rounded-full bg-gradient-to-br from-saffron to-coral text-ink">
                  <ArIcon className="size-3.5" />
                </span>
                Menu 3D & réalité augmentée · sans application
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-7 font-display text-[42px] leading-[1.02] font-semibold tracking-tight text-balance sm:text-[64px] xl:text-[72px]">
                Vos clients ne lisent plus seulement votre menu.{" "}
                <span className="font-serif font-medium italic text-gradient">Ils découvrent vos plats avant de commander.</span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-pretty text-white/65">
                Transformez votre carte en une expérience immersive grâce à la 3D et à la réalité augmentée. Un simple QR code suffit.
              </p>
            </Reveal>
            <Reveal delay={240} className="mt-9 flex flex-wrap gap-3">
              <a href="#demo" className="group inline-flex h-14 items-center gap-2 rounded-full bg-saffron px-7 text-[16px] font-semibold text-ink shadow-[0_14px_50px_-12px_rgba(255,181,71,.75)] transition hover:brightness-105">
                Essayer la démo <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </a>
              <a href="#demande-demo" className="inline-flex h-14 items-center rounded-full border border-white/15 bg-white/5 px-7 text-[16px] font-medium text-white backdrop-blur transition hover:bg-white/10">
                Demander une démonstration
              </a>
            </Reveal>
            <Reveal delay={320}>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-white/50">
                <li className="flex items-center gap-2"><Smartphone className="size-4 text-holo" /> iPhone et Android</li>
                <li className="flex items-center gap-2"><Languages className="size-4 text-holo" /> 9 langues</li>
                <li className="flex items-center gap-2"><QrCode className="size-4 text-holo" /> Aucun téléchargement</li>
              </ul>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <HeroStage />
          </Reveal>
        </div>
      </section>

      {/* ─── Concept ─────────────────────────────────────────────────────── */}
      <section id="concept" className="relative scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            eyebrow="Le concept"
            title={<>Du QR code à la table, <span className="font-serif italic text-gradient">en trois gestes</span></>}
            intro="Le client s'installe, scanne le QR code et accède instantanément à un menu magnifique, dans sa langue. Il fait tourner chaque plat du bout du doigt, puis le pose sur sa table, à taille réelle."
          />
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              { icon: ScanLine, step: "01", title: "Je scanne", text: "Avec l'appareil photo du téléphone. Pas d'application, pas d'inscription : le menu s'ouvre en un instant." },
              { icon: Hand, step: "02", title: "J'explore en 3D", text: "Photos gourmandes, descriptions, prix, allergènes… et chaque plat en 3D, à faire tourner et zoomer du doigt." },
              { icon: Box, step: "03", title: "Je le vois sur ma table", text: "« Voir ce plat sur ma table » : l'assiette apparaît devant moi, en réalité augmentée, à sa taille réelle." },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 120} className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-8">
                <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-[radial-gradient(closest-side,rgba(255,181,71,.18),transparent)] transition-transform duration-700 group-hover:scale-125" />
                <span className="font-display text-[13px] font-semibold tracking-widest text-white/35">{s.step}</span>
                <s.icon className="mt-6 size-9 text-saffron" strokeWidth={1.5} />
                <h3 className="mt-6 font-display text-2xl font-semibold">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{s.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Démonstration interactive ───────────────────────────────────── */}
      <section id="demo" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
        <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,245,225,.08),transparent)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionTitle
              eyebrow="Démonstration interactive"
              title={<>Testez l&apos;expérience <span className="font-serif italic text-gradient">comme vos clients</span></>}
              intro="Ce menu est un vrai menu VoirAvantDeCommander, celui d'un restaurant fictif créé pour la démonstration. Touchez un plat marqué « 3D », faites-le tourner, changez de langue."
            />
            <Reveal delay={120} className="mt-10 flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/[.04] p-6 sm:flex-row sm:items-center">
              <div className="w-40 shrink-0 overflow-hidden rounded-2xl bg-white p-2.5" dangerouslySetInnerHTML={{ __html: demoQr }} />
              <div>
                <p className="font-display text-xl font-semibold">Et sur votre table ?</p>
                <p className="mt-2 leading-relaxed text-white/60">
                  Scannez ce QR code avec votre téléphone, ouvrez un plat puis touchez « Voir ce plat sur ma table ». La réalité augmentée s&apos;ouvre sur iPhone comme sur Android.
                </p>
                <a href="/menu/demo" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-[15px] font-semibold text-saffron hover:underline">
                  Ouvrir la démo dans un nouvel onglet <ArrowRight className="size-4" />
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal delay={150} className="hidden lg:block">
            <DemoPhone src="/menu/demo" />
          </Reveal>
          <Reveal className="lg:hidden">
            <Link href="/menu/demo" className="flex h-16 items-center justify-center gap-3 rounded-full bg-saffron text-[17px] font-semibold text-ink">
              <ArIcon className="size-5" /> Ouvrir le menu de démonstration
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ─── Réalité augmentée ───────────────────────────────────────────── */}
      <section id="realite-augmentee" className="relative scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            center
            eyebrow="Réalité augmentée"
            title={<>Le plat apparaît <span className="font-serif italic text-gradient">directement sur la table</span></>}
            intro="Le téléphone détecte la table, l'assiette s'y pose à taille réelle. Le client tourne autour, se penche, compare. Il sait exactement ce qu'il va recevoir."
          />
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              { icon: Smartphone, title: "iPhone et iPad", text: "AR Quick Look d'Apple, intégré à Safari, avec un modèle USDZ optimisé pour chaque plat." },
              { icon: MonitorSmartphone, title: "Android", text: "Scene Viewer de Google ou WebXR dans Chrome, avec le modèle GLB du plat." },
              { icon: Layers, title: "Partout ailleurs", text: "Sur ordinateur ou sur un téléphone non compatible, la visionneuse 3D interactive prend le relais." },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 120} className="rounded-[28px] border border-white/10 bg-white/[.03] p-8">
                <c.icon className="size-8 text-holo" strokeWidth={1.5} />
                <h3 className="mt-6 font-display text-xl font-semibold">{c.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{c.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-[28px] border border-saffron/25 bg-gradient-to-br from-saffron/10 to-transparent p-8">
              <h3 className="font-display text-xl font-semibold">La taille réelle, vraiment</h3>
              <p className="mt-3 leading-relaxed text-white/65">
                Les dimensions de chaque plat sont mesurées sur le modèle 3D puis validées : nous n&apos;inventons jamais une taille. Tant qu&apos;elle n&apos;est pas validée,
                le client peut librement redimensionner le plat.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/[.03] p-8">
              <h3 className="font-display text-xl font-semibold">Rapide, même en 4G</h3>
              <p className="mt-3 leading-relaxed text-white/65">
                Photos optimisées automatiquement, modèles 3D analysés (poids, géométrie, textures) et chargés seulement quand le client ouvre un plat.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Avantages ───────────────────────────────────────────────────── */}
      <section id="avantages" className="relative scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            eyebrow="Pour les restaurateurs"
            title={<>Donnez envie, <span className="font-serif italic text-gradient">avant même la première bouchée</span></>}
            intro="Un plat que l'on voit sous tous les angles se choisit plus facilement. VoirAvantDeCommander met vos assiettes en valeur et accompagne vos clients jusqu'au dessert."
          />
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Sparkles, title: "Valorisez vos plats", text: "Chaque assiette se découvre en 3D, comme si elle était déjà servie. Le travail de votre cuisine est enfin visible." },
              { icon: UtensilsCrossed, title: "Donnez envie de commander", text: "Photos gourmandes, descriptions soignées et plats à faire tourner : le client choisit en confiance." },
              { icon: CakeSlice, title: "Desserts et suggestions", text: "Des recommandations « Parfait avec… » que vous choisissez mettent en avant desserts, boissons et accompagnements." },
              { icon: Wand2, title: "Une expérience mémorable", text: "Vos clients jouent avec le menu, se montrent les plats sur la table et en parlent autour d'eux." },
              { icon: Store, title: "Démarquez-vous", text: "Une technologie encore rare en restauration, qui donne à votre établissement une image moderne et soignée." },
              { icon: Globe2, title: "Pour tous vos clients", text: "Menu en 9 langues avec détection automatique, allergènes clairement indiqués, lecture confortable à table." },
            ].map((b, i) => (
              <Reveal key={b.title} delay={(i % 3) * 100} className="rounded-[28px] border border-white/10 bg-white/[.03] p-8 transition hover:border-white/20 hover:bg-white/[.05]">
                <b.icon className="size-7 text-saffron" strokeWidth={1.6} />
                <h3 className="mt-5 font-display text-xl font-semibold">{b.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{b.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-8 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.02] p-5 text-[14.5px] text-white/55">
            <BarChart3 className="mt-0.5 size-5 shrink-0 text-holo" />
            Nous ne promettons pas de chiffres : nous vous aidons à mesurer. Vous suivez les consultations du menu, les plats les plus regardés en 3D et les ouvertures
            en réalité augmentée, avec des statistiques anonymes, sans cookie.
          </Reveal>
        </div>
      </section>

      {/* ─── Langues ─────────────────────────────────────────────────────── */}
      <section aria-label="Langues proposées" className="border-y border-white/8 bg-white/[.02] py-8">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-12 pe-12 motion-reduce:animate-none">
            {[...LANGUAGES, ...LANGUAGES].map((l, i) => (
              <span key={i} className="font-display text-2xl whitespace-nowrap text-white/40">
                {l}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Fonctionnement ──────────────────────────────────────────────── */}
      <section id="fonctionnement" className="relative scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            eyebrow="Fonctionnement"
            title={<>Votre menu 3D, <span className="font-serif italic text-gradient">en trois étapes</span></>}
            intro="Vous n'avez rien à installer ni à gérer techniquement. Nous nous occupons de tout, et vous gardez la main sur votre carte."
          />
          <ol className="relative mt-16 grid gap-6 lg:grid-cols-3">
            <div className="pointer-events-none absolute top-10 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-saffron/0 via-saffron/50 to-saffron/0 lg:block" />
            {[
              { n: "1", title: "Vous nous confiez votre carte", text: "Votre menu (PDF, Excel…), vos photos et vos plats. Chaque plat est modélisé en 3D, aux formats iPhone (USDZ) et Android (GLB)." },
              { n: "2", title: "Votre menu prend vie", text: "Le menu est généré à vos couleurs, traduit, et chaque plat associé à sa photo et à son modèle 3D. Vous vérifiez tout avant la mise en ligne." },
              { n: "3", title: "Vos clients scannent", text: "Posez le QR code sur vos tables. Changez un prix, un plat ou une photo quand vous le souhaitez : le QR code ne change jamais." },
            ].map((s, i) => (
              <Reveal as="li" key={s.n} delay={i * 140} className="relative rounded-[28px] border border-white/10 bg-ink-2 p-8">
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-saffron to-coral font-display text-2xl font-bold text-ink shadow-[0_10px_40px_-10px_rgba(255,106,61,.6)]">{s.n}</span>
                <h3 className="mt-7 font-display text-2xl font-semibold">{s.title}</h3>
                <p className="mt-3 leading-relaxed text-white/60">{s.text}</p>
              </Reveal>
            ))}
          </ol>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: QrCode, title: "QR code permanent" },
              { icon: RefreshCw, title: "Mises à jour instantanées" },
              { icon: ToggleLeft, title: "Plat épuisé en un clic" },
              { icon: Languages, title: "Traductions vérifiables" },
              { icon: Wheat, title: "Allergènes affichés" },
              { icon: Palette, title: "Design à votre image" },
              { icon: BarChart3, title: "Statistiques anonymes" },
              { icon: ShieldCheck, title: "Données protégées" },
            ].map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 70} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.02] px-5 py-4">
                <f.icon className="size-5 shrink-0 text-holo" strokeWidth={1.7} />
                <span className="text-[15px] text-white/80">{f.title}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Questions fréquentes ────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <SectionTitle center eyebrow="Questions fréquentes" title="Tout ce que vous voulez savoir" />
          <div className="mt-12 divide-y divide-white/10 rounded-[28px] border border-white/10 bg-white/[.02]">
            {[
              ["Mes clients doivent-ils installer une application ?", "Non. Le menu s'ouvre dans le navigateur du téléphone après avoir scanné le QR code avec l'appareil photo."],
              ["Quels téléphones sont compatibles avec la réalité augmentée ?", "Les iPhone et iPad récents (AR Quick Look) et la plupart des téléphones Android récents compatibles ARCore (Scene Viewer ou WebXR dans Chrome). Sur les autres appareils, le plat reste visible en 3D interactive."],
              ["Que se passe-t-il si je change un prix ou un plat ?", "La modification est faite dans un brouillon, puis publiée en un clic. Le QR code reste le même : inutile de réimprimer quoi que ce soit. Un plat épuisé peut être indiqué indisponible instantanément."],
              ["Dans quelles langues le menu est-il disponible ?", "Français, anglais, espagnol, italien, allemand, portugais, arabe, chinois et japonais, avec détection automatique de la langue du téléphone. Les traductions sont relues et corrigeables, et les prix ne sont jamais modifiés."],
              ["Tous mes plats doivent-ils être en 3D ?", "Non. Les plats sans modèle 3D s'affichent normalement, avec leur photo et leur description. Vous pouvez commencer par vos plats signatures."],
              ["Mes clients sont-ils suivis ?", "Non. Nous mesurons uniquement des compteurs anonymes (consultations, plats ouverts, utilisation de la 3D), sans cookie ni donnée personnelle."],
            ].map(([q, a]) => (
              <details key={q} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[17px] font-medium">
                  {q}
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-white/60 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 leading-relaxed text-white/60">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demande de démo et contact ──────────────────────────────────── */}
      <section id="demande-demo" className="relative scroll-mt-24 py-24 sm:py-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_100%,rgba(255,106,61,.14),transparent)]" />
        <div id="contact" className="mx-auto grid max-w-7xl scroll-mt-24 gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionTitle
              eyebrow="Démonstration"
              title={<>Voyons ensemble <span className="font-serif italic text-gradient">votre menu en 3D</span></>}
              intro="Laissez-nous vos coordonnées : nous vous présentons l'expérience sur votre propre téléphone et répondons à toutes vos questions."
            />
            <Reveal delay={120} className="mt-10 space-y-3 text-white/70">
              {contactEmail ? (
                <p>
                  E-mail :{" "}
                  <a href={`mailto:${contactEmail}`} className="font-medium text-white hover:underline">
                    {contactEmail}
                  </a>
                </p>
              ) : null}
              {contactPhone ? (
                <p>
                  Téléphone :{" "}
                  <a href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`} className="font-medium text-white hover:underline">
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
