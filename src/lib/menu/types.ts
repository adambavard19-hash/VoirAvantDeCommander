import type { ThemeSettings } from "@/lib/theme";
import type { RestaurantSettings } from "@/lib/restaurant-settings";

/**
 * Texte multilingue : langue → texte. La langue principale du restaurant est
 * toujours présente ; les autres langues n'apparaissent que si une traduction
 * à jour existe.
 */
export type L10n = Record<string, string>;

/** Référence d'image stockée par clé (l'URL publique est résolue à l'affichage). */
export type ImageRef = {
  key: string;
  variants: { key: string; width: number }[];
  width: number | null;
  height: number | null;
  blur: string | null;
};

export type ModelRef = {
  glbKey: string | null;
  usdzKey: string | null;
  /** Dimensions réelles confirmées par un humain → AR à taille fixe. */
  scaleValidated: boolean;
  dimensionsCm: { width: number; height: number; depth: number } | null;
};

export type SnapshotDish = {
  id: string;
  name: L10n;
  description: L10n;
  priceCents: number | null;
  variants: { label: L10n; priceCents: number }[];
  photo: ImageRef | null;
  model: ModelRef | null;
  allergens: string[];
  tags: string[];
  available: boolean;
  featured: boolean;
  recommendations: string[];
};

export type SnapshotCategory = {
  id: string;
  name: L10n;
  description: L10n;
  icon: string | null;
  image: ImageRef | null;
  dishes: SnapshotDish[];
};

export type MenuSnapshot = {
  schema: 1;
  restaurant: {
    id: string;
    slug: string;
    name: string;
    tagline: L10n;
    description: L10n;
    practicalInfo: L10n;
    cuisineType: string | null;
    address: { line1: string | null; line2: string | null; postalCode: string | null; city: string | null; country: string };
    phone: string | null;
    email: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    mapsUrl: string | null;
    logo: ImageRef | null;
    cover: ImageRef | null;
    /** Entrée animée : devanture puis salle (absent des versions publiées avant cette fonctionnalité). */
    facade?: ImageRef | null;
    interior?: ImageRef | null;
    /** Vidéo d'entrée (clé de stockage), prioritaire sur les photos. */
    entranceVideo?: { key: string; mime: string } | null;
    gallery: ImageRef[];
    theme: ThemeSettings;
    defaultLocale: string;
    locales: string[];
    currency: string;
    settings: RestaurantSettings;
  };
  categories: SnapshotCategory[];
  /** Langues dont une partie du contenu provient d'une traduction automatique. */
  autoTranslatedLocales: string[];
};
