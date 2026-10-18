import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isValidSlug, slugify } from "@/lib/slug";
import { DEFAULT_THEME, themeSchema } from "@/lib/theme";
import { ALL_LOCALES } from "@/lib/i18n/locales";
import { CATEGORY_PRESETS, DEFAULT_CATEGORY_KEYS } from "@/lib/categories";
import { restaurantSettingsSchema } from "@/lib/restaurant-settings";
import { badRequest, conflict } from "@/lib/http";
import type { Prisma } from "@/generated/prisma/client";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => !v || /^https?:\/\//i.test(v), "L'adresse doit commencer par http:// ou https://");

const localeEnum = z.enum(ALL_LOCALES as [string, ...string[]]);

export const restaurantInputSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(120),
  tagline: optionalText(200),
  description: optionalText(2000),
  practicalInfo: optionalText(2000),
  cuisineType: optionalText(80),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  postalCode: optionalText(20),
  city: optionalText(120),
  country: z.string().trim().length(2).default("FR"),
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Adresse e-mail invalide"),
  website: optionalUrl,
  instagram: optionalText(200),
  facebook: optionalUrl,
  mapsUrl: optionalUrl,
  defaultLocale: localeEnum.default("fr"),
  locales: z.array(localeEnum).max(20).default(["fr"]),
  currency: z.string().trim().length(3).default("EUR"),
  theme: themeSchema.default(DEFAULT_THEME),
  settings: restaurantSettingsSchema.default(restaurantSettingsSchema.parse({})),
  logoAssetId: z.string().optional().nullable(),
  coverAssetId: z.string().optional().nullable(),
  facadeAssetId: z.string().optional().nullable(),
  interiorAssetId: z.string().optional().nullable(),
  entranceVideoAssetId: z.string().optional().nullable(),
  galleryAssetIds: z.array(z.string()).max(30).optional(),
});

export type RestaurantInput = z.infer<typeof restaurantInputSchema>;

/** Trouve un slug libre à partir d'un nom (et de la ville en cas de doublon). */
export async function uniqueSlug(name: string, city?: string | null): Promise<string> {
  const base = slugify(name) || "restaurant";
  const candidates = [base, city ? slugify(`${name} ${city}`) : null].filter(Boolean) as string[];
  for (const c of candidates) if (isValidSlug(c) && !(await slugTaken(c))) return c;
  for (let i = 2; i < 500; i++) {
    const c = `${base.slice(0, 54)}-${i}`;
    if (!(await slugTaken(c))) return c;
  }
  throw conflict("Impossible de générer une adresse unique pour ce restaurant.");
}

async function slugTaken(slug: string): Promise<boolean> {
  const [r, redirect] = await Promise.all([
    db.restaurant.findUnique({ where: { slug }, select: { id: true } }),
    db.slugRedirect.findUnique({ where: { slug }, select: { slug: true } }),
  ]);
  return !!r || !!redirect;
}

/** Vérifie que les fichiers référencés appartiennent bien à ce restaurant (isolation). */
async function assertOwnAssets(restaurantId: string, ids: (string | null | undefined)[]) {
  const wanted = ids.filter((x): x is string => !!x);
  if (!wanted.length) return;
  const count = await db.asset.count({ where: { id: { in: wanted }, restaurantId, kind: "IMAGE" } });
  if (count !== new Set(wanted).size) throw badRequest("Image invalide pour ce restaurant.");
}

function normalizeLocales(input: RestaurantInput) {
  return [input.defaultLocale, ...input.locales.filter((l) => l !== input.defaultLocale)];
}

export async function createRestaurant(input: RestaurantInput, userId: string, opts: { slug?: string } = {}) {
  const slug = opts.slug ?? (await uniqueSlug(input.name, input.city));
  if (!isValidSlug(slug)) throw badRequest("Adresse (slug) invalide.");
  if (await slugTaken(slug)) throw conflict("Cette adresse de menu est déjà utilisée.");

  const restaurant = await db.$transaction(async (tx) => {
    const created = await tx.restaurant.create({
      data: {
        slug,
        name: input.name,
        tagline: input.tagline,
        description: input.description,
        practicalInfo: input.practicalInfo,
        cuisineType: input.cuisineType,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        postalCode: input.postalCode,
        city: input.city,
        country: input.country.toUpperCase(),
        phone: input.phone,
        email: input.email,
        website: input.website,
        instagram: input.instagram,
        facebook: input.facebook,
        mapsUrl: input.mapsUrl,
        defaultLocale: input.defaultLocale,
        locales: normalizeLocales(input),
        currency: input.currency.toUpperCase(),
        theme: input.theme as Prisma.InputJsonValue,
        settings: input.settings as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
    await tx.category.createMany({
      data: DEFAULT_CATEGORY_KEYS.map((key, position) => {
        const preset = CATEGORY_PRESETS.find((p) => p.key === key)!;
        return { restaurantId: created.id, name: preset.name, icon: preset.icon, position };
      }),
    });
    return created;
  });
  await audit({ restaurantId: restaurant.id, userId, action: "restaurant.create", details: { slug } });
  return restaurant;
}

export async function updateRestaurant(restaurantId: string, input: RestaurantInput, userId: string) {
  await assertOwnAssets(restaurantId, [input.logoAssetId, input.coverAssetId, input.facadeAssetId, input.interiorAssetId, input.entranceVideoAssetId, ...(input.galleryAssetIds ?? [])]);
  const restaurant = await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      practicalInfo: input.practicalInfo,
      cuisineType: input.cuisineType,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      postalCode: input.postalCode,
      city: input.city,
      country: input.country.toUpperCase(),
      phone: input.phone,
      email: input.email,
      website: input.website,
      instagram: input.instagram,
      facebook: input.facebook,
      mapsUrl: input.mapsUrl,
      defaultLocale: input.defaultLocale,
      locales: normalizeLocales(input),
      currency: input.currency.toUpperCase(),
      theme: input.theme as Prisma.InputJsonValue,
      settings: input.settings as Prisma.InputJsonValue,
      logoAssetId: input.logoAssetId ?? null,
      coverAssetId: input.coverAssetId ?? null,
      facadeAssetId: input.facadeAssetId ?? null,
      interiorAssetId: input.interiorAssetId ?? null,
      entranceVideoAssetId: input.entranceVideoAssetId ?? null,
      ...(input.galleryAssetIds ? { galleryAssetIds: input.galleryAssetIds } : {}),
    },
  });
  await audit({ restaurantId, userId, action: "restaurant.update" });
  return restaurant;
}

/**
 * Change l'adresse du menu. L'ancienne adresse est conservée en redirection :
 * les QR codes déjà imprimés continuent de fonctionner.
 */
export async function changeSlug(restaurantId: string, newSlug: string, userId: string) {
  if (!isValidSlug(newSlug)) throw badRequest("Adresse invalide : lettres minuscules, chiffres et tirets uniquement.");
  const current = await db.restaurant.findUniqueOrThrow({ where: { id: restaurantId }, select: { slug: true } });
  if (current.slug === newSlug) return current;
  const redirect = await db.slugRedirect.findUnique({ where: { slug: newSlug } });
  if (redirect && redirect.restaurantId !== restaurantId) throw conflict("Cette adresse est déjà utilisée.");
  if (await db.restaurant.findUnique({ where: { slug: newSlug }, select: { id: true } })) throw conflict("Cette adresse est déjà utilisée.");
  await db.$transaction([
    ...(redirect ? [db.slugRedirect.delete({ where: { slug: newSlug } })] : []),
    db.slugRedirect.upsert({ where: { slug: current.slug }, update: { restaurantId }, create: { slug: current.slug, restaurantId } }),
    db.restaurant.update({ where: { id: restaurantId }, data: { slug: newSlug } }),
  ]);
  await audit({ restaurantId, userId, action: "restaurant.slug", details: { from: current.slug, to: newSlug } });
  return { slug: newSlug };
}
