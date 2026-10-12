import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { parseTheme } from "@/lib/theme";
import { parseRestaurantSettings } from "@/lib/restaurant-settings";
import { sourceHash } from "@/lib/i18n/translatable";
import { parsePriceVariants } from "./variants";
import type { Asset, Translation } from "@/generated/prisma/client";
import type { ImageRef, L10n, MenuSnapshot, ModelRef, SnapshotCategory } from "./types";

export function imageRef(asset: Asset | null | undefined): ImageRef | null {
  if (!asset || asset.status !== "READY" || asset.kind !== "IMAGE") return null;
  const variants = Object.entries((asset.variants as Record<string, string> | null) ?? {})
    .map(([name, key]) => ({ key, width: Number(name.replace(/\D/g, "")) }))
    .filter((v) => v.width > 0)
    .sort((a, b) => a.width - b.width);
  const meta = (asset.metadata as { blur?: string } | null) ?? {};
  return { key: asset.storageKey, variants, width: asset.width, height: asset.height, blur: meta.blur ?? null };
}

function readyKey(asset: Asset | null | undefined, kind: Asset["kind"]): string | null {
  return asset && asset.status === "READY" && asset.kind === kind ? asset.storageKey : null;
}

type TranslationIndex = Map<string, Translation>;

function indexTranslations(rows: Translation[]): TranslationIndex {
  return new Map(rows.map((t) => [`${t.entityType}:${t.entityId}:${t.field}:${t.locale}`, t]));
}

/**
 * Texte multilingue d'un champ. Une traduction n'est retenue que si elle est à
 * jour (empreinte du texte source identique) : on n'affiche jamais une traduction
 * d'une ancienne description, qui pourrait mentionner d'autres ingrédients.
 */
function l10n(
  source: string | null | undefined,
  entityType: Translation["entityType"],
  entityId: string,
  field: string,
  locales: string[],
  defaultLocale: string,
  index: TranslationIndex,
  autoUsed: Set<string>,
): L10n {
  const text = source?.trim();
  if (!text) return {};
  const out: L10n = { [defaultLocale]: text };
  const hash = sourceHash(text);
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const t = index.get(`${entityType}:${entityId}:${field}:${locale}`);
    if (t && t.sourceHash === hash && t.value.trim()) {
      out[locale] = t.value.trim();
      if (t.source === "AUTO") autoUsed.add(locale);
    }
  }
  return out;
}

/**
 * Construit l'instantané du menu à partir du brouillon. Utilisé à l'identique
 * pour la prévisualisation et pour la publication : ce que l'on prévisualise
 * est exactement ce qui sera publié.
 */
export async function buildSnapshot(restaurantId: string): Promise<MenuSnapshot> {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    include: { logo: true, cover: true },
  });
  const [categories, translations, galleryAssets] = await Promise.all([
    db.category.findMany({
      where: { restaurantId, isVisible: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        image: true,
        dishes: {
          where: { isVisible: true },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          include: {
            photo: true,
            glb: true,
            usdz: true,
            recommendations: { orderBy: { position: "asc" }, include: { target: { select: { id: true, isVisible: true } } } },
          },
        },
      },
    }),
    db.translation.findMany({ where: { restaurantId } }),
    restaurant.galleryAssetIds.length
      ? db.asset.findMany({ where: { id: { in: restaurant.galleryAssetIds }, restaurantId } })
      : Promise.resolve([] as Asset[]),
  ]);

  const locales = [restaurant.defaultLocale, ...restaurant.locales.filter((l) => l !== restaurant.defaultLocale)];
  const def = restaurant.defaultLocale;
  const index = indexTranslations(translations);
  const autoUsed = new Set<string>();
  const tr = (source: string | null | undefined, type: Translation["entityType"], id: string, field: string) =>
    l10n(source, type, id, field, locales, def, index, autoUsed);

  const visibleDishIds = new Set(categories.flatMap((c) => c.dishes.map((d) => d.id)));

  const snapshotCategories: SnapshotCategory[] = categories
    .map((c) => ({
      id: c.id,
      name: tr(c.name, "CATEGORY", c.id, "name"),
      description: tr(c.description, "CATEGORY", c.id, "description"),
      icon: c.icon,
      image: imageRef(c.image),
      dishes: c.dishes.map((d) => {
        const glbKey = readyKey(d.glb, "MODEL_GLB");
        const usdzKey = readyKey(d.usdz, "MODEL_USDZ");
        const glbMeta = (d.glb?.metadata as { dimensionsCm?: ModelRef["dimensionsCm"] } | null) ?? null;
        const model: ModelRef | null =
          glbKey || usdzKey
            ? {
                glbKey,
                usdzKey,
                scaleValidated: d.scaleStatus === "VALIDATED",
                dimensionsCm:
                  d.realWidthCm && d.realDepthCm && d.realHeightCm
                    ? { width: d.realWidthCm, depth: d.realDepthCm, height: d.realHeightCm }
                    : (glbMeta?.dimensionsCm ?? null),
              }
            : null;
        return {
          id: d.id,
          name: tr(d.name, "DISH", d.id, "name"),
          description: tr(d.description, "DISH", d.id, "description"),
          priceCents: d.priceCents,
          variants: parsePriceVariants(d.priceVariants).map((v, i) => ({
            label: tr(v.label, "DISH", d.id, `variant.${i}`),
            priceCents: v.priceCents,
          })),
          photo: imageRef(d.photo),
          model,
          allergens: d.allergens,
          tags: d.tags,
          available: d.isAvailable,
          featured: d.isFeatured,
          recommendations: d.recommendations
            .filter((r) => r.target.isVisible && visibleDishIds.has(r.targetId))
            .map((r) => r.targetId),
        };
      }),
    }))
    .filter((c) => c.dishes.length > 0);

  const galleryById = new Map(galleryAssets.map((a) => [a.id, a]));
  return {
    schema: 1,
    restaurant: {
      id: restaurant.id,
      slug: restaurant.slug,
      name: restaurant.name,
      tagline: tr(restaurant.tagline, "RESTAURANT", restaurant.id, "tagline"),
      description: tr(restaurant.description, "RESTAURANT", restaurant.id, "description"),
      practicalInfo: tr(restaurant.practicalInfo, "RESTAURANT", restaurant.id, "practicalInfo"),
      cuisineType: restaurant.cuisineType,
      address: {
        line1: restaurant.addressLine1,
        line2: restaurant.addressLine2,
        postalCode: restaurant.postalCode,
        city: restaurant.city,
        country: restaurant.country,
      },
      phone: restaurant.phone,
      email: restaurant.email,
      website: restaurant.website,
      instagram: restaurant.instagram,
      facebook: restaurant.facebook,
      mapsUrl: restaurant.mapsUrl,
      logo: imageRef(restaurant.logo),
      cover: imageRef(restaurant.cover),
      gallery: restaurant.galleryAssetIds
        .map((id) => imageRef(galleryById.get(id)))
        .filter((x): x is ImageRef => x !== null),
      theme: parseTheme(restaurant.theme),
      defaultLocale: def,
      locales,
      currency: restaurant.currency,
      settings: parseRestaurantSettings(restaurant.settings),
    },
    categories: snapshotCategories,
    autoTranslatedLocales: [...autoUsed].sort(),
  };
}

/** Empreinte stable du contenu : permet de savoir si le brouillon diffère de la version publiée. */
export function snapshotHash(snapshot: MenuSnapshot): string {
  return createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
