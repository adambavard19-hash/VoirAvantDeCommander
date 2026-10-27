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
import { sha256 } from "@/lib/crypto";
import { sourceHash } from "@/lib/i18n/translatable";
import { menuUrl, publishMenu } from "@/lib/menu/publish";
import { storage, restaurantPrefix } from "@/lib/storage";
import { THEME_PRESETS } from "@/lib/theme";
import { ALL_LOCALES } from "@/lib/i18n/locales";
import { DEMO_CATEGORIES, DEMO_DISHES, DEMO_RESTAURANT, LOS_AMIGOS_CATEGORIES, LOS_AMIGOS_DISHES } from "./demo-data";
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

/** Variantes de la démo : plats d'exemple (site vitrine) et plats réels scannés (démo commerciale). */
const DEMO_VARIANTS = [
  { slug: DEMO_RESTAURANT.slug, name: DEMO_RESTAURANT.name, preset: "noir-or", cover: "cover", categories: DEMO_CATEGORIES, dishes: DEMO_DISHES },
  {
    slug: "demo-futuriste",
    name: DEMO_RESTAURANT.name,
    preset: "braise",
    cover: "cover-los-amigos-4",
    categories: LOS_AMIGOS_CATEGORIES,
    dishes: LOS_AMIGOS_DISHES,
  },
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
  const cover = await readDemoFile(`photos/${variant.cover}.jpg`);
  if (cover) {
    const asset = await createAssetFromBuffer({ restaurantId: rid, userId, name: "couverture.jpg", buffer: cover });
    if (asset?.status === "READY") await db.restaurant.update({ where: { id: rid }, data: { coverAssetId: asset.id } });
  }

  await attachEntrance(rid, userId);
  await attachEntranceVideo(rid, userId);

  const categoryIds = new Map<string, string>();
  for (const [position, c] of variant.categories.entries()) {
    const parentKey = "parent" in c ? (c.parent as string | undefined) : undefined;
    const cat = await db.category.create({
      data: { restaurantId: rid, name: c.name, icon: c.icon, position, parentId: parentKey ? categoryIds.get(parentKey) : null },
    });
    categoryIds.set(c.key, cat.id);
    translations.push({ entityType: "CATEGORY", entityId: cat.id, field: "name", source: c.name, values: c.tr as Record<string, string> });
  }

  const dishIds = new Map<string, string>();
  let missingFiles = 0;
  for (const [position, d] of variant.dishes.entries()) {
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

  for (const d of variant.dishes) {
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
  if (!facade || !interior) {
    console.warn("⚠️  Entrée animée : photos public/demo/photos/devanture.jpg ou interieur.jpg introuvables.");
    return false;
  }
  const [f, i] = await Promise.all([
    createAssetFromBuffer({ restaurantId: rid, userId, name: "devanture.jpg", buffer: facade }),
    createAssetFromBuffer({ restaurantId: rid, userId, name: "interieur.jpg", buffer: interior }),
  ]);
  if (f?.status !== "READY" || i?.status !== "READY") {
    console.warn(`⚠️  Entrée animée : photos non enregistrées (${f?.error ?? i?.error ?? "erreur inconnue"}).`);
    return false;
  }
  await db.restaurant.update({ where: { id: rid }, data: { facadeAssetId: f.id, interiorAssetId: i.id } });
  console.log("✓ Entrée animée : photos de devanture et de salle enregistrées.");
  return true;
}

/** Vidéo d'entrée de la démo (de la rue jusqu'à la salle). Renvoie true si elle vient d'être ajoutée. */
async function attachEntranceVideo(rid: string, userId: string): Promise<boolean> {
  const video = await readDemoFile("videos/entree.mp4");
  if (!video) {
    console.warn("⚠️  Entrée vidéo : public/demo/videos/entree.mp4 introuvable.");
    return false;
  }
  const asset = await createAssetFromBuffer({ restaurantId: rid, userId, name: "entree.mp4", buffer: video });
  if (asset?.status !== "READY") {
    console.warn(`⚠️  Entrée vidéo : non enregistrée (${asset?.error ?? "erreur inconnue"}).`);
    return false;
  }
  await db.restaurant.update({ where: { id: rid }, data: { entranceVideoAssetId: asset.id } });
  console.log("✓ Entrée vidéo enregistrée.");
  return true;
}

async function main() {
  const admin = await ensureAdmin();
  if (!admin) {
    console.log("ℹ️  Restaurant de démonstration non créé (aucun administrateur).");
    return;
  }
  for (const variant of DEMO_VARIANTS) {
    const existing = await db.restaurant.findUnique({
      where: { slug: variant.slug },
      include: { entranceVideo: true, dishes: { select: { name: true } }, categories: { select: { name: true, parentId: true } } },
    });
    // Démo d'une version précédente (plats changés depuis) : on la recrée, même adresse donc même QR code.
    const names = (list: { name: string }[]) => list.map((d) => d.name).sort().join("|");
    // Signature de la démo : plats, catégories (et sous-catégories) et thème.
    const outdated =
      existing &&
      (names(existing.dishes) !== names(variant.dishes) ||
        names(existing.categories) !== names(variant.categories) ||
        existing.categories.filter((c) => c.parentId).length !== variant.categories.filter((c) => "parent" in c && c.parent).length ||
        (existing.theme as { preset?: string } | null)?.preset !== variant.preset);
    // Au déploiement (--if-missing), une démo existante n'est JAMAIS supprimée ni recréée : elle a
    // pu être modifiée dans l'administration (plats ajoutés…). Recréation uniquement sur demande
    // explicite : npm run db:seed -- --reset-demo
    if (process.argv.includes("--if-missing") && existing && outdated && !process.argv.includes("--reset-demo")) {
      console.log(`ℹ️  Démo /menu/${variant.slug} différente de la version de référence : conservée telle quelle (modifiée dans l'administration ?).`);
    }
    if (process.argv.includes("--if-missing") && existing && !process.argv.includes("--reset-demo")) {
      // Démo uniquement : son QR code suit l'adresse du site (ex. passage de *.vercel.app
      // au nom de domaine). Les QR codes des vrais restaurants ne changent jamais.
      const target = menuUrl(variant.slug);
      const { count } = await db.qrCode.updateMany({ where: { restaurantId: existing.id, NOT: { targetUrl: target } }, data: { targetUrl: target } });
      console.log(`✓ Démo /menu/${variant.slug} déjà présente${count ? ` (QR code mis à jour : ${target})` : ""}.`);
      console.log(`  Entrée : photos ${existing.facadeAssetId ? "oui" : "non"}, vidéo ${existing.entranceVideoAssetId ? "oui" : "non"}.`);
      // Démo créée avant l'entrée animée : on l'ajoute puis on republie.
      const addedPhotos = !existing.facadeAssetId && (await attachEntrance(existing.id, admin.id));
      // Vidéo remplacée dans public/demo (ex. meilleure qualité) : on met la démo à jour.
      const file = await readDemoFile("videos/entree.mp4");
      const old = existing.entranceVideo;
      const videoChanged = !!old && !!file && old.checksum !== sha256(file);
      const addedVideo = (!old || videoChanged) && (await attachEntranceVideo(existing.id, admin.id));
      if (addedPhotos || addedVideo) {
        const result = await publishMenu(existing.id, admin.id, addedVideo ? "Entrée en vidéo" : "Entrée animée");
        console.log(`✓ Entrée ${addedVideo ? "vidéo" : "animée"} ajoutée à /menu/${variant.slug}${result.ok ? ` (version ${result.version.number})` : ""}.`);
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
