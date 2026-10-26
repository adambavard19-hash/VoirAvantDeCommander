import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/http";
import { PlateRimError, smoothPlateRim } from "@/lib/assets/plate-rim";
import { ALLERGEN_CODES } from "@/lib/allergens";
import { DISH_TAG_CODES } from "@/lib/tags";
import { CATEGORY_ICONS } from "@/lib/categories";
import { priceVariantSchema } from "./variants";
import { createAssetFromBuffer } from "@/lib/assets/service";
import { rescaleGlb } from "@/lib/assets/glb";
import { storage } from "@/lib/storage";
import type { AssetKind, Prisma } from "@/generated/prisma/client";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const dimension = z.number().positive().max(300).nullable().optional();

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  description: nullableText(400),
  icon: z.enum(CATEGORY_ICONS).nullable().optional(),
  isVisible: z.boolean().optional(),
  imageAssetId: z.string().nullable().optional(),
  /** Catégorie parente : fait de cette catégorie une sous-catégorie (un seul niveau). */
  parentId: z.string().nullable().optional(),
});

/** Vérifie qu'une catégorie peut être rangée sous `parentId` (même restaurant, un seul niveau). */
export async function assertCategoryParent(restaurantId: string, categoryId: string | null, parentId: string | null | undefined) {
  if (!parentId) return;
  if (parentId === categoryId) throw badRequest("Une catégorie ne peut pas être sa propre sous-catégorie.");
  const parent = await db.category.findFirst({ where: { id: parentId, restaurantId }, select: { parentId: true } });
  if (!parent) throw badRequest("Catégorie parente introuvable.");
  if (parent.parentId) throw badRequest("Une sous-catégorie ne peut pas contenir d'autres sous-catégories.");
  if (categoryId && (await db.category.count({ where: { parentId: categoryId } })))
    throw badRequest("Cette catégorie contient des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.");
}

export const dishInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Nom requis").max(140),
  description: nullableText(1200),
  priceCents: z.number().int().min(0).max(10_000_000).nullable().optional(),
  priceVariants: z.array(priceVariantSchema).max(8).optional(),
  photoAssetId: z.string().nullable().optional(),
  glbAssetId: z.string().nullable().optional(),
  usdzAssetId: z.string().nullable().optional(),
  allergens: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])).max(14).optional(),
  tags: z.array(z.enum(DISH_TAG_CODES as [string, ...string[]])).max(10).optional(),
  isAvailable: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  realWidthCm: dimension,
  realDepthCm: dimension,
  realHeightCm: dimension,
  scaleStatus: z.enum(["UNVERIFIED", "VALIDATED"]).optional(),
  recommendationIds: z.array(z.string()).max(6).optional(),
});

export type DishInput = z.infer<typeof dishInputSchema>;

/** Vérifie qu'un fichier appartient au restaurant et est du bon type (isolation entre restaurants). */
async function assertAsset(restaurantId: string, assetId: string | null | undefined, kind: AssetKind) {
  if (!assetId) return;
  const asset = await db.asset.findFirst({ where: { id: assetId, restaurantId, kind }, select: { status: true } });
  if (!asset) throw badRequest("Fichier invalide pour ce restaurant.");
  if (asset.status !== "READY") throw badRequest("Ce fichier n'est pas prêt (téléversement incomplet ou fichier invalide).");
}

async function assertCategory(restaurantId: string, categoryId: string) {
  const c = await db.category.findFirst({ where: { id: categoryId, restaurantId }, select: { id: true } });
  if (!c) throw badRequest("Catégorie invalide.");
}

async function validateDishRefs(restaurantId: string, input: Partial<DishInput>, dishId?: string) {
  if (input.categoryId) await assertCategory(restaurantId, input.categoryId);
  await assertAsset(restaurantId, input.photoAssetId, "IMAGE");
  await assertAsset(restaurantId, input.glbAssetId, "MODEL_GLB");
  await assertAsset(restaurantId, input.usdzAssetId, "MODEL_USDZ");
  if (input.recommendationIds?.length) {
    const ids = [...new Set(input.recommendationIds)].filter((id) => id !== dishId);
    const count = await db.dish.count({ where: { id: { in: ids }, restaurantId } });
    if (count !== ids.length) throw badRequest("Recommandation invalide.");
  }
}

function dishData(input: Partial<DishInput>): Prisma.DishUncheckedUpdateInput {
  const data: Prisma.DishUncheckedUpdateInput = {};
  const keys = [
    "categoryId",
    "name",
    "description",
    "priceCents",
    "photoAssetId",
    "glbAssetId",
    "usdzAssetId",
    "allergens",
    "tags",
    "isAvailable",
    "isVisible",
    "isFeatured",
    "realWidthCm",
    "realDepthCm",
    "realHeightCm",
  ] as const;
  for (const k of keys) if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
  if (input.priceVariants !== undefined) data.priceVariants = input.priceVariants as Prisma.InputJsonValue;
  if (input.scaleStatus !== undefined) {
    data.scaleStatus = input.scaleStatus;
    data.scaleValidatedAt = input.scaleStatus === "VALIDATED" ? new Date() : null;
  }
  return data;
}

async function setRecommendations(dishId: string, ids: string[]) {
  const unique = [...new Set(ids)].filter((id) => id !== dishId);
  await db.$transaction([
    db.dishRecommendation.deleteMany({ where: { dishId } }),
    db.dishRecommendation.createMany({ data: unique.map((targetId, position) => ({ dishId, targetId, position })) }),
  ]);
}

export async function createDish(restaurantId: string, input: DishInput) {
  await validateDishRefs(restaurantId, input);
  const last = await db.dish.findFirst({
    where: { restaurantId, categoryId: input.categoryId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const dish = await db.dish.create({
    data: {
      ...(dishData(input) as Prisma.DishUncheckedCreateInput),
      restaurantId,
      categoryId: input.categoryId,
      name: input.name,
      position: (last?.position ?? -1) + 1,
    },
  });
  if (input.recommendationIds) await setRecommendations(dish.id, input.recommendationIds);
  return dish;
}

export async function updateDish(restaurantId: string, dishId: string, input: Partial<DishInput>) {
  const current = await db.dish.findFirst({ where: { id: dishId, restaurantId } });
  if (!current) throw notFound("Plat introuvable.");
  await validateDishRefs(restaurantId, input, dishId);
  const data = dishData(input);
  // Nouveau modèle 3D : l'échelle validée pour l'ancien modèle ne vaut plus.
  if (input.glbAssetId !== undefined && input.glbAssetId !== current.glbAssetId && input.scaleStatus === undefined) {
    data.scaleStatus = "UNVERIFIED";
    data.scaleValidatedAt = null;
  }
  if (input.categoryId && input.categoryId !== current.categoryId) {
    const last = await db.dish.findFirst({ where: { restaurantId, categoryId: input.categoryId }, orderBy: { position: "desc" }, select: { position: true } });
    data.position = (last?.position ?? -1) + 1;
  }
  const dish = await db.dish.update({ where: { id: dishId }, data });
  if (input.recommendationIds) await setRecommendations(dishId, input.recommendationIds);
  return dish;
}

export async function duplicateDish(restaurantId: string, dishId: string) {
  const d = await db.dish.findFirst({ where: { id: dishId, restaurantId }, include: { recommendations: true } });
  if (!d) throw notFound("Plat introuvable.");
  await db.dish.updateMany({ where: { restaurantId, categoryId: d.categoryId, position: { gt: d.position } }, data: { position: { increment: 1 } } });
  const copy = await db.dish.create({
    data: {
      restaurantId: d.restaurantId,
      categoryId: d.categoryId,
      name: `${d.name} (copie)`,
      description: d.description,
      priceCents: d.priceCents,
      priceVariants: (d.priceVariants ?? undefined) as Prisma.InputJsonValue | undefined,
      photoAssetId: d.photoAssetId,
      glbAssetId: d.glbAssetId,
      usdzAssetId: d.usdzAssetId,
      allergens: d.allergens,
      tags: d.tags,
      isAvailable: d.isAvailable,
      isFeatured: d.isFeatured,
      realWidthCm: d.realWidthCm,
      realDepthCm: d.realDepthCm,
      realHeightCm: d.realHeightCm,
      scaleStatus: d.scaleStatus,
      scaleValidatedAt: d.scaleValidatedAt,
      position: d.position + 1,
      isVisible: false,
    },
  });
  await setRecommendations(copy.id, d.recommendations.map((r) => r.targetId));
  return copy;
}

/** Réordonne catégories et plats en une fois (y compris déplacement de plats entre catégories). */
export const reorderSchema = z.object({
  categories: z.array(z.object({ id: z.string(), dishIds: z.array(z.string()) })).max(200),
});

export async function reorderMenu(restaurantId: string, input: z.infer<typeof reorderSchema>) {
  const [categories, dishes] = await Promise.all([
    db.category.findMany({ where: { restaurantId }, select: { id: true } }),
    db.dish.findMany({ where: { restaurantId }, select: { id: true } }),
  ]);
  const catIds = new Set(categories.map((c) => c.id));
  const dishIds = new Set(dishes.map((d) => d.id));
  const seen = new Set<string>();
  for (const c of input.categories) {
    if (!catIds.has(c.id)) throw badRequest("Catégorie inconnue.");
    for (const d of c.dishIds) {
      if (!dishIds.has(d) || seen.has(d)) throw badRequest("Plat inconnu ou dupliqué.");
      seen.add(d);
    }
  }
  await db.$transaction([
    ...input.categories.map((c, position) => db.category.update({ where: { id: c.id }, data: { position } })),
    ...input.categories.flatMap((c) =>
      c.dishIds.map((dishId, position) => db.dish.update({ where: { id: dishId }, data: { categoryId: c.id, position } })),
    ),
  ]);
}

/**
 * Corrige l'échelle d'un modèle GLB pour qu'il ait sa taille réelle en AR.
 * Un nouveau fichier est créé (l'original est conservé) et associé au plat.
 */
export async function rescaleDishModel(params: {
  restaurantId: string;
  dishId: string;
  userId: string;
  targetCm: number;
  axis: "width" | "depth" | "height";
}) {
  const dish = await db.dish.findFirst({ where: { id: params.dishId, restaurantId: params.restaurantId }, include: { glb: true } });
  if (!dish?.glb) throw badRequest("Ce plat n'a pas de modèle GLB.");
  const dims = (dish.glb.metadata as { dimensionsCm?: Record<string, number> } | null)?.dimensionsCm;
  const measured = dims?.[params.axis];
  if (!measured || measured <= 0) throw badRequest("Dimensions du modèle inconnues.");
  const factor = params.targetCm / measured;
  if (factor < 0.0001 || factor > 10000) throw badRequest("Facteur d'échelle hors limites.");
  const buffer = await storage().getBuffer(dish.glb.storageKey);
  if (!buffer) throw badRequest("Fichier GLB introuvable dans le stockage.");
  const scaled = rescaleGlb(buffer, factor);
  const name = dish.glb.originalName.replace(/\.glb$/i, "") + "-echelle-reelle.glb";
  const asset = await createAssetFromBuffer({ restaurantId: params.restaurantId, userId: params.userId, name, buffer: scaled });
  if (!asset || asset.status !== "READY") throw badRequest("La mise à l'échelle a échoué.");
  const newDims = (asset.metadata as { dimensionsCm?: { width: number; depth: number; height: number } } | null)?.dimensionsCm;
  await db.dish.update({
    where: { id: dish.id },
    data: {
      glbAssetId: asset.id,
      realWidthCm: newDims?.width ?? null,
      realDepthCm: newDims?.depth ?? null,
      realHeightCm: newDims?.height ?? null,
      scaleStatus: "UNVERIFIED",
      scaleValidatedAt: null,
    },
  });
  return { asset, factor };
}

/**
 * Bord d'assiette régularisé : crée un NOUVEAU modèle GLB (l'original reste sur le plat
 * tant que l'utilisateur n'a pas choisi la version corrigée dans l'aperçu).
 */
export async function plateRimDishModel(params: { restaurantId: string; dishId: string; userId: string }) {
  const dish = await db.dish.findFirst({ where: { id: params.dishId, restaurantId: params.restaurantId }, include: { glb: true } });
  if (!dish?.glb) throw badRequest("Ce plat n'a pas de modèle GLB.");
  const buffer = await storage().getBuffer(dish.glb.storageKey);
  if (!buffer) throw badRequest("Fichier GLB introuvable dans le stockage.");
  let result;
  try {
    result = await smoothPlateRim(buffer);
  } catch (error) {
    if (error instanceof PlateRimError) throw badRequest(error.message);
    throw error;
  }
  const name = dish.glb.originalName.replace(/(-bord-corrige)?\.glb$/i, "") + "-bord-corrige.glb";
  const asset = await createAssetFromBuffer({ restaurantId: params.restaurantId, userId: params.userId, name, buffer: result.buffer });
  if (!asset || asset.status !== "READY") throw badRequest("La correction du bord a échoué.");
  return { original: dish.glb, corrected: asset, info: result.info };
}
