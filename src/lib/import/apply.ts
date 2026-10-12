import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/http";
import { audit } from "@/lib/audit";
import { ALLERGEN_CODES } from "@/lib/allergens";
import { DISH_TAG_CODES } from "@/lib/tags";
import { iconForCategoryName } from "@/lib/categories";
import { createDish, updateDish } from "@/lib/menu/editor";
import type { Prisma } from "@/generated/prisma/client";
import type { ImportProposal, ImportReport } from "./types";

const mediaLink = z
  .object({
    assetId: z.string(),
    name: z.string(),
    confidence: z.enum(["exact", "explicit", "suggested", "manual"]),
    score: z.number(),
    confirmed: z.boolean(),
    thumbUrl: z.string().nullable().optional(),
  })
  .nullable();

/** Validation de la proposition renvoyée par le navigateur après relecture. */
export const proposalSchema = z.object({
  version: z.literal(1),
  documents: z.array(z.any()),
  categories: z.array(z.object({ ref: z.string(), name: z.string().trim().min(1).max(80), existingId: z.string().nullable() })),
  dishes: z.array(
    z.object({
      ref: z.string(),
      action: z.enum(["create", "update", "skip"]),
      existingDishId: z.string().nullable(),
      existingMatch: z.object({ dishId: z.string(), name: z.string(), score: z.number(), confirmed: z.boolean() }).nullable(),
      categoryRef: z.string(),
      name: z.string().trim().max(140),
      description: z.string().max(1200).nullable(),
      priceCents: z.number().int().min(0).max(10_000_000).nullable(),
      variants: z.array(z.object({ label: z.string().trim().min(1).max(60), priceCents: z.number().int().min(0) })).max(8),
      allergens: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])),
      tags: z.array(z.enum(DISH_TAG_CODES as [string, ...string[]])),
      current: z.any().optional(),
      media: z.object({ photo: mediaLink, glb: mediaLink, usdz: mediaLink }),
      source: z.string(),
      flags: z.array(z.string()),
    }),
  ),
  unmatched: z.array(z.any()),
  failedFiles: z.array(z.any()),
  warnings: z.array(z.string()),
});

const KIND_FOR_SLOT = { photo: "IMAGE", glb: "MODEL_GLB", usdz: "MODEL_USDZ" } as const;

/**
 * Applique la proposition relue au BROUILLON (rien n'est publié). Seules les
 * associations de fichiers confirmées sont appliquées ; les suggestions non
 * validées sont ignorées et comptées dans le compte rendu.
 */
export async function applyImport(params: { restaurantId: string; jobId: string; userId: string; proposal: ImportProposal }): Promise<ImportReport> {
  const { restaurantId, jobId, userId } = params;
  const job = await db.importJob.findFirst({ where: { id: jobId, restaurantId } });
  if (!job) throw notFound("Import introuvable.");
  if (job.status === "APPLIED") throw conflict("Cet import a déjà été appliqué.");
  const proposal = proposalSchema.parse(params.proposal) as ImportProposal;

  // Isolation : tous les fichiers cités doivent appartenir à ce restaurant, avec le bon type.
  const links = proposal.dishes.flatMap((d) =>
    (["photo", "glb", "usdz"] as const).map((slot) => ({ slot, link: d.media[slot] })).filter((x) => x.link?.confirmed),
  );
  const assetIds = [...new Set(links.map((l) => l.link!.assetId))];
  const assets = await db.asset.findMany({ where: { id: { in: assetIds }, restaurantId, status: "READY" }, select: { id: true, kind: true } });
  const kindById = new Map(assets.map((a) => [a.id, a.kind]));
  for (const { slot, link } of links) {
    if (kindById.get(link!.assetId) !== KIND_FOR_SLOT[slot]) throw badRequest(`Fichier invalide pour « ${link!.name} ».`);
  }
  const existingIds = new Set((await db.dish.findMany({ where: { restaurantId }, select: { id: true } })).map((d) => d.id));
  const existingCategoryIds = new Set((await db.category.findMany({ where: { restaurantId }, select: { id: true } })).map((c) => c.id));

  const report: ImportReport = { categoriesCreated: 0, dishesCreated: 0, dishesUpdated: 0, mediaAttached: 0, skippedSuggestions: 0, errors: [] };
  const active = proposal.dishes.filter((d) => d.action !== "skip");

  // Catégories nécessaires.
  const categoryIdByRef = new Map<string, string>();
  for (const c of proposal.categories) {
    if (c.existingId) {
      if (!existingCategoryIds.has(c.existingId)) throw badRequest("Catégorie inconnue.");
      categoryIdByRef.set(c.ref, c.existingId);
    }
  }
  const lastPosition = await db.category.findFirst({ where: { restaurantId }, orderBy: { position: "desc" }, select: { position: true } });
  let position = (lastPosition?.position ?? -1) + 1;
  for (const c of proposal.categories) {
    if (c.existingId || !active.some((d) => d.categoryRef === c.ref)) continue;
    const created = await db.category.create({ data: { restaurantId, name: c.name, icon: iconForCategoryName(c.name), position: position++ } });
    categoryIdByRef.set(c.ref, created.id);
    report.categoriesCreated++;
  }

  for (const d of active) {
    try {
      const media: Record<string, string> = {};
      for (const slot of ["photo", "glb", "usdz"] as const) {
        const l = d.media[slot];
        if (!l) continue;
        if (l.confirmed) media[`${slot}AssetId`] = l.assetId;
        else report.skippedSuggestions++;
      }
      const targetExisting = d.existingDishId ?? (d.existingMatch?.confirmed ? d.existingMatch.dishId : null);
      const categoryId = categoryIdByRef.get(d.categoryRef);

      if (d.action === "update" || targetExisting) {
        if (!targetExisting || !existingIds.has(targetExisting)) throw new Error("plat existant introuvable");
        // On ne remplace jamais une valeur existante par une valeur vide.
        await updateDish(restaurantId, targetExisting, {
          ...(d.description ? { description: d.description } : {}),
          ...(d.priceCents !== null ? { priceCents: d.priceCents } : {}),
          ...(d.variants.length ? { priceVariants: d.variants } : {}),
          ...(d.allergens.length ? { allergens: d.allergens } : {}),
          ...(d.tags.length ? { tags: d.tags } : {}),
          ...media,
        });
        report.dishesUpdated++;
      } else {
        if (!categoryId) throw new Error("catégorie manquante");
        if (!d.name.trim()) throw new Error("nom manquant");
        await createDish(restaurantId, {
          categoryId,
          name: d.name.trim(),
          description: d.description,
          priceCents: d.priceCents,
          priceVariants: d.variants,
          allergens: d.allergens,
          tags: d.tags,
          ...media,
        });
        report.dishesCreated++;
      }
      report.mediaAttached += Object.keys(media).length;
    } catch (error) {
      report.errors.push(`« ${d.name} » : ${error instanceof Error ? error.message : "erreur"}`);
    }
  }

  await db.importJob.update({
    where: { id: jobId },
    data: { status: "APPLIED", appliedAt: new Date(), proposal: proposal as unknown as Prisma.InputJsonValue, report: report as unknown as Prisma.InputJsonValue },
  });
  await audit({ restaurantId, userId, action: "import.apply", details: report as unknown as Record<string, unknown> });
  return report;
}
