/**
 * Initialisation de la base :
 *  1. crée l'administrateur principal (ADMIN_EMAIL / ADMIN_PASSWORD) s'il n'existe pas ;
 *  2. crée ou recrée le restaurant de démonstration (fictif) et le publie.
 *
 * Lancement : npm run db:seed
 * Option --if-missing : ne touche pas au restaurant de démonstration s'il existe
 * déjà (utilisé à chaque déploiement, voir le script vercel-build).
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { createRestaurant, restaurantInputSchema } from "@/lib/restaurants";
import { createAssetFromBuffer } from "@/lib/assets/service";
import { sourceHash } from "@/lib/i18n/translatable";
import { menuUrl, publishMenu } from "@/lib/menu/publish";
import { storage, restaurantPrefix } from "@/lib/storage";
import { THEME_PRESETS } from "@/lib/theme";
import { ALL_LOCALES } from "@/lib/i18n/locales";
import { DEMO_CATEGORIES, DEMO_DISHES, DEMO_RESTAURANT } from "./demo-data";
import type { TranslatableEntity } from "@/generated/prisma/client";

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.log("ℹ️  ADMIN_EMAIL / ADMIN_PASSWORD non définis : aucun administrateur créé.");
    return (await db.user.findFirst({ where: { role: "SUPER_ADMIN" } })) ?? null;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Administrateur existant : ${email}`);
    return existing;
  }
  const problem = passwordProblem(password);
  if (problem) throw new Error(`ADMIN_PASSWORD : ${problem}`);
  const user = await db.user.create({
    data: { email, name: "Administrateur", passwordHash: await hashPassword(password), role: "SUPER_ADMIN" },
  });
  console.log(`✓ Administrateur créé : ${email}`);
  return user;
}

async function readDemoFile(rel: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", "demo", rel));
  } catch {
    return null;
  }
}

/** Variantes de la démo : même restaurant fictif, deux mises en page. */
const DEMO_VARIANTS = [
  { slug: DEMO_RESTAURANT.slug, name: DEMO_RESTAURANT.name, preset: "noir-or" },
  { slug: "demo-futuriste", name: DEMO_RESTAURANT.name, preset: "code" },
] as const;

type DemoVariant = (typeof DEMO_VARIANTS)[number];

async function seedDemo(userId: string, variant: DemoVariant = DEMO_VARIANTS[0]) {
  const old = await db.restaurant.findUnique({ where: { slug: variant.slug } });
  if (old) {
    await storage().deletePrefix(restaurantPrefix(old.id));
    await db.restaurant.delete({ where: { id: old.id } });
  }

  const input = restaurantInputSchema.parse({
    name: variant.name,
    cuisineType: DEMO_RESTAURANT.cuisineType,
    tagline: DEMO_RESTAURANT.tagline,
    practicalInfo: DEMO_RESTAURANT.practicalInfo,
    city: DEMO_RESTAURANT.city,
    defaultLocale: "fr",
    locales: ALL_LOCALES,
    theme: THEME_PRESETS[variant.preset]!.theme,
  });
  const restaurant = await createRestaurant(input, userId, { slug: variant.slug });
  const rid = restaurant.id;
  await db.category.deleteMany({ where: { restaurantId: rid } });

  const translations: { entityType: TranslatableEntity; entityId: string; field: string; source: string; values: Record<string, string> }[] = [];
  translations.push(
    { entityType: "RESTAURANT", entityId: rid, field: "tagline", source: DEMO_RESTAURANT.tagline, values: DEMO_RESTAURANT.tr.tagline as Record<string, string> },
    { entityType: "RESTAURANT", entityId: rid, field: "practicalInfo", source: DEMO_RESTAURANT.practicalInfo, values: DEMO_RESTAURANT.tr.practicalInfo as Record<string, string> },
  );

  // Couverture
  const cover = await readDemoFile("photos/cover.jpg");
  if (cover) {
    const asset = await createAssetFromBuffer({ restaurantId: rid, userId, name: "couverture.jpg", buffer: cover });
    if (asset?.status === "READY") await db.restaurant.update({ where: { id: rid }, data: { coverAssetId: asset.id } });
  }

  await attachEntrance(rid, userId);

  const categoryIds = new Map<string, string>();
  for (const [position, c] of DEMO_CATEGORIES.entries()) {
    const cat = await db.category.create({ data: { restaurantId: rid, name: c.name, icon: c.icon, position } });
    categoryIds.set(c.key, cat.id);
    translations.push({ entityType: "CATEGORY", entityId: cat.id, field: "name", source: c.name, values: c.tr as Record<string, string> });
  }

  const dishIds = new Map<string, string>();
  let missingFiles = 0;
  for (const [position, d] of DEMO_DISHES.entries()) {
    let photoAssetId: string | null = null;
    let glbAssetId: string | null = null;
    let usdzAssetId: string | null = null;
    if (d.photo) {
      const buf = await readDemoFile(`photos/${d.photo}.jpg`);
      if (buf) photoAssetId = (await createAssetFromBuffer({ restaurantId: rid, userId, name: `${d.photo}.jpg`, buffer: buf }))?.id ?? null;
      else missingFiles++;
    }
    if (d.model) {
      const glb = await readDemoFile(`models/${d.model}.glb`);
      const usdz = await readDemoFile(`models/${d.model}.usdz`);
      if (glb) glbAssetId = (await createAssetFromBuffer({ restaurantId: rid, userId, name: `${d.model}.glb`, buffer: glb }))?.id ?? null;
      else missingFiles++;
      if (usdz) usdzAssetId = (await createAssetFromBuffer({ restaurantId: rid, userId, name: `${d.model}.usdz`, buffer: usdz }))?.id ?? null;
      else missingFiles++;
    }
    const dish = await db.dish.create({
      data: {
        restaurantId: rid,
        categoryId: categoryIds.get(d.category)!,
        name: d.name,
        description: d.description ?? null,
        priceCents: d.priceCents ?? null,
        priceVariants: d.variants?.map((v) => ({ label: v.label, priceCents: v.priceCents })) ?? undefined,
        photoAssetId,
        glbAssetId,
        usdzAssetId,
        allergens: d.allergens ?? [],
        tags: d.tags ?? [],
        isFeatured: !!d.featured,
        position,
        // Dimensions des plats de démonstration : connues car les modèles sont générés à l'échelle.
        ...(d.realSize && glbAssetId
          ? { realWidthCm: d.realSize[0], realDepthCm: d.realSize[1], realHeightCm: d.realSize[2], scaleStatus: "VALIDATED" as const, scaleValidatedAt: new Date() }
          : {}),
      },
    });
    dishIds.set(d.key, dish.id);
    translations.push({ entityType: "DISH", entityId: dish.id, field: "name", source: d.name, values: d.tr.name as Record<string, string> });
    if (d.description && d.tr.description)
      translations.push({ entityType: "DISH", entityId: dish.id, field: "description", source: d.description, values: d.tr.description as Record<string, string> });
    d.variants?.forEach((v, i) => {
      if (v.tr) translations.push({ entityType: "DISH", entityId: dish.id, field: `variant.${i}`, source: v.label, values: v.tr as Record<string, string> });
    });
  }

  for (const d of DEMO_DISHES) {
    for (const [position, target] of (d.recommendations ?? []).entries()) {
      await db.dishRecommendation.create({ data: { dishId: dishIds.get(d.key)!, targetId: dishIds.get(target)!, position } });
    }
  }

  await db.translation.createMany({
    data: translations.flatMap((t) =>
      Object.entries(t.values).map(([locale, value]) => ({
        restaurantId: rid,
        entityType: t.entityType,
        entityId: t.entityId,
        field: t.field,
        locale,
        value,
        sourceHash: sourceHash(t.source),
        source: "MANUAL" as const,
        provider: "seed",
      })),
    ),
  });

  const result = await publishMenu(rid, userId, "Menu de démonstration");
  console.log(`✓ Restaurant de démonstration publié : /menu/${variant.slug} (${result.ok ? `version ${result.version.number}` : "non publié"})`);
  if (missingFiles) console.log(`⚠️  ${missingFiles} fichier(s) de démonstration absents de public/demo (lancez npm run demo:models).`);
}

/**
 * Entrée animée de la démo (photos de devanture et de salle d'un restaurant fictif).
 * Renvoie true si elle vient d'être ajoutée.
 */
async function attachEntrance(rid: string, userId: string): Promise<boolean> {
  const [facade, interior] = await Promise.all([readDemoFile("photos/devanture.jpg"), readDemoFile("photos/interieur.jpg")]);
  if (!facade || !interior) return false;
  const [f, i] = await Promise.all([
    createAssetFromBuffer({ restaurantId: rid, userId, name: "devanture.jpg", buffer: facade }),
    createAssetFromBuffer({ restaurantId: rid, userId, name: "interieur.jpg", buffer: interior }),
  ]);
  if (f?.status !== "READY" || i?.status !== "READY") return false;
  await db.restaurant.update({ where: { id: rid }, data: { facadeAssetId: f.id, interiorAssetId: i.id } });
  return true;
}

async function main() {
  const admin = await ensureAdmin();
  if (!admin) {
    console.log("ℹ️  Restaurant de démonstration non créé (aucun administrateur).");
    return;
  }
  for (const variant of DEMO_VARIANTS) {
    const existing = await db.restaurant.findUnique({ where: { slug: variant.slug } });
    if (process.argv.includes("--if-missing") && existing) {
      // Démo uniquement : son QR code suit l'adresse du site (ex. passage de *.vercel.app
      // au nom de domaine). Les QR codes des vrais restaurants ne changent jamais.
      const target = menuUrl(variant.slug);
      const { count } = await db.qrCode.updateMany({ where: { restaurantId: existing.id, NOT: { targetUrl: target } }, data: { targetUrl: target } });
      console.log(`✓ Démo /menu/${variant.slug} déjà présente${count ? ` (QR code mis à jour : ${target})` : ""}.`);
      // Démo créée avant l'entrée animée : on l'ajoute puis on republie.
      if (!existing.facadeAssetId && (await attachEntrance(existing.id, admin.id))) {
        const result = await publishMenu(existing.id, admin.id, "Entrée animée");
        console.log(`✓ Entrée animée ajoutée à /menu/${variant.slug}${result.ok ? ` (version ${result.version.number})` : ""}.`);
      }
      continue;
    }
    await seedDemo(admin.id, variant);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
