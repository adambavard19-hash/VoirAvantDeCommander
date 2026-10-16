import "server-only";
import { storage } from "@/lib/storage";
import { formatPrice } from "@/lib/money";
import { allergenLabel } from "@/lib/allergens";
import { tagLabel } from "@/lib/tags";
import { LOCALES, isLocale, localeDir } from "@/lib/i18n/locales";
import { menuStrings, type MenuStrings } from "@/lib/i18n/menu-strings";
import { themeCssVars, themeTokens } from "@/lib/theme";
import type { ImageRef, L10n, MenuSnapshot } from "./types";

/** Vue du menu dans UNE langue, prête pour l'affichage (URL résolues, prix formatés). */
export type ImageView = { src: string; srcSet: string; width: number | null; height: number | null; blur: string | null };

export type DishView = {
  id: string;
  name: string;
  description: string;
  price: string | null;
  priceCents: number | null;
  variants: { label: string; price: string; priceCents: number }[];
  photo: ImageView | null;
  model: {
    glb: string | null;
    usdz: string | null;
    scaleValidated: boolean;
    dimensions: string | null;
  } | null;
  allergens: { code: string; label: string }[];
  tags: { code: string; label: string }[];
  available: boolean;
  featured: boolean;
  recommendations: string[];
  categoryId: string;
};

export type CategoryView = {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  image: ImageView | null;
  layout: "tiles" | "list";
  dishes: DishView[];
};

export type MenuView = {
  locale: string;
  dir: "ltr" | "rtl";
  strings: MenuStrings;
  languages: { code: string; label: string }[];
  preview: boolean;
  autoTranslated: boolean;
  themeVars: Record<string, string>;
  themeMode: "dark" | "light";
  restaurant: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    practicalInfo: string;
    cuisineType: string | null;
    address: string | null;
    mapsUrl: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
    logo: ImageView | null;
    cover: ImageView | null;
    /** Entrée animée (devanture → salle), si activée et complète. */
    entrance: { facade: ImageView; interior: ImageView; focus: { x: number; y: number } } | null;
    currency: string;
    priceLocale: string;
    settings: MenuSnapshot["restaurant"]["settings"];
  };
  categories: CategoryView[];
  featured: string[];
};

function text(value: L10n, locale: string, fallback: string): string {
  return value[locale] ?? value[fallback] ?? "";
}

export function imageView(ref: ImageRef | null): ImageView | null {
  if (!ref) return null;
  const s = storage();
  const variants = ref.variants.length ? ref.variants : [{ key: ref.key, width: ref.width ?? 1200 }];
  const largest = variants[variants.length - 1]!;
  const mid = variants.find((v) => v.width >= 900) ?? largest;
  return {
    src: s.publicUrl(mid.key),
    srcSet: variants.map((v) => `${s.publicUrl(v.key)} ${v.width}w`).join(", "),
    width: ref.width,
    height: ref.height,
    blur: ref.blur,
  };
}

function entranceView(r: MenuSnapshot["restaurant"]) {
  const facade = imageView(r.facade ?? null);
  const interior = imageView(r.interior ?? null);
  if (!facade || !interior || r.settings.entranceIntro === false) return null;
  return { facade, interior, focus: r.settings.entranceFocus ?? { x: 0.5, y: 0.62 } };
}

function formatDimensions(d: { width: number; height: number; depth: number } | null): string | null {
  if (!d) return null;
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString().replace(".", ",");
  const footprint = Math.max(d.width, d.depth);
  const round = Math.abs(d.width - d.depth) / Math.max(d.width, d.depth, 1) < 0.08;
  return round ? `Ø ${fmt(footprint)} cm · h ${fmt(d.height)} cm` : `${fmt(d.width)} × ${fmt(d.depth)} cm · h ${fmt(d.height)} cm`;
}

export function toMenuView(snapshot: MenuSnapshot, locale: string, opts: { preview?: boolean } = {}): MenuView {
  const r = snapshot.restaurant;
  const def = r.defaultLocale;
  const fmt = (cents: number) => formatPrice(cents, r.currency, def);
  const tokens = themeTokens(r.theme);
  const uiLocale = isLocale(locale) ? locale : "en";

  const categories: CategoryView[] = snapshot.categories.map((c) => {
    const dishes: DishView[] = c.dishes
      .filter((d) => d.available || r.settings.showUnavailable)
      .map((d) => ({
        id: d.id,
        name: text(d.name, locale, def),
        description: text(d.description, locale, def),
        price: d.priceCents !== null ? fmt(d.priceCents) : null,
        priceCents: d.priceCents,
        variants: d.variants.map((v) => ({ label: text(v.label, locale, def), price: fmt(v.priceCents), priceCents: v.priceCents })),
        photo: imageView(d.photo),
        model: d.model
          ? {
              glb: d.model.glbKey ? storage().publicUrl(d.model.glbKey) : null,
              usdz: d.model.usdzKey ? storage().publicUrl(d.model.usdzKey) : null,
              scaleValidated: d.model.scaleValidated,
              dimensions: formatDimensions(d.model.dimensionsCm),
            }
          : null,
        allergens: r.settings.showAllergens ? d.allergens.map((code) => ({ code, label: allergenLabel(code, uiLocale) })) : [],
        tags: d.tags.map((code) => ({ code, label: tagLabel(code, uiLocale) })),
        available: d.available,
        featured: d.featured,
        recommendations: d.recommendations,
        categoryId: c.id,
      }));
    const withPhoto = dishes.filter((d) => d.photo).length;
    return {
      id: c.id,
      name: text(c.name, locale, def),
      description: text(c.description, locale, def),
      icon: c.icon,
      image: imageView(c.image),
      layout: dishes.length && withPhoto / dishes.length >= 0.5 ? "tiles" : "list",
      dishes,
    };
  });

  const address = [r.address.line1, r.address.line2, [r.address.postalCode, r.address.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return {
    locale,
    dir: localeDir(locale),
    strings: menuStrings(uiLocale),
    languages: r.locales.map((code) => ({ code, label: isLocale(code) ? LOCALES[code].label : code })),
    preview: !!opts.preview,
    autoTranslated: snapshot.autoTranslatedLocales.includes(locale),
    themeVars: themeCssVars(tokens),
    themeMode: tokens.mode,
    restaurant: {
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: text(r.tagline, locale, def),
      description: text(r.description, locale, def),
      practicalInfo: text(r.practicalInfo, locale, def),
      cuisineType: r.cuisineType,
      address: address || null,
      mapsUrl:
        r.mapsUrl ??
        (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${address}`)}` : null),
      phone: r.phone,
      website: r.website,
      instagram: r.instagram,
      logo: imageView(r.logo),
      cover: imageView(r.cover),
      entrance: entranceView(r),
      currency: r.currency,
      priceLocale: def,
      settings: r.settings,
    },
    categories: categories.filter((c) => c.dishes.length > 0),
    featured: categories.flatMap((c) => c.dishes.filter((d) => d.featured).map((d) => d.id)),
  };
}
