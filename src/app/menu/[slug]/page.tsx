import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { loadPublicMenu } from "@/lib/menu/public";
import { toMenuView, imageView } from "@/lib/menu/view";
import { pickLocale } from "@/lib/i18n/locales";
import { menuStrings } from "@/lib/i18n/menu-strings";
import { MenuExperience } from "@/components/menu/menu-experience";
import { MenuUnavailable } from "@/components/menu/menu-unavailable";
import { EntranceIntro } from "@/components/menu/entrance-intro";
import { entranceGateScript, entranceStorageKey } from "@/lib/menu/entrance";
import { statDaily } from "@/lib/stats";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPublicMenu(slug);
  if (result.kind !== "ok") return { title: "Menu", robots: { index: false } };
  const r = result.snapshot.restaurant;
  const cover = imageView(r.cover);
  const tagline = r.tagline[r.defaultLocale];
  return {
    title: { absolute: `${r.name} — Menu` },
    description: tagline ?? `Découvrez le menu de ${r.name} en 3D et en réalité augmentée.`,
    openGraph: { title: `${r.name} — Menu`, description: tagline, images: cover ? [cover.src] : undefined },
  };
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const preview = one(sp.preview) === "1";
  const result = await loadPublicMenu(slug, { preview });

  if (result.kind === "not-found") notFound();
  if (result.kind === "redirect") {
    const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, one(v) ?? ""]]))).toString();
    permanentRedirect(`/menu/${result.slug}${qs ? `?${qs}` : ""}`);
  }
  const h = await headers();
  if (result.kind === "unavailable") {
    const locale = pickLocale(["fr", "en", "es", "it", "de", "pt", "ar", "zh", "ja"], "fr", one(sp.lang), h.get("accept-language"));
    return <MenuUnavailable name={result.name} strings={menuStrings(locale)} />;
  }

  const r = result.snapshot.restaurant;
  const locale = pickLocale(r.locales, r.defaultLocale, one(sp.lang), h.get("accept-language"));
  const view = toMenuView(result.snapshot, locale, { preview: result.preview });
  // Mise en page « tableau de bord » : courbe des consultations réelles des 7 derniers jours.
  const trend =
    view.layout === "dashboard" && !result.preview
      ? (await statDaily({ restaurantId: r.id, days: 7 })).map((d) => ({ day: d.day, count: d.MENU_VIEW }))
      : undefined;
  const entrance = view.restaurant.entrance;
  if (!entrance) return <MenuExperience view={view} trend={trend} />;
  const strings = menuStrings(locale);
  const key = entranceStorageKey(r.slug);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: entranceGateScript(key) }} />
      <EntranceIntro
        storageKey={key}
        facade={entrance.facade}
        interior={entrance.interior}
        video={entrance.video}
        focus={entrance.focus}
        name={r.name}
        welcome={strings.welcome}
        skipLabel={strings.skipIntro}
      />
      <MenuExperience view={view} trend={trend} />
    </>
  );
}
