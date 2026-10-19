import { db } from "@/lib/db";
import { badRequest, conflict, notFound, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { assertCategoryParent, categoryInputSchema } from "@/lib/menu/editor";

type P = { id: string; categoryId: string };

async function findCategory(restaurantId: string, categoryId: string) {
  const category = await db.category.findFirst({ where: { id: categoryId, restaurantId } });
  if (!category) throw notFound("Catégorie introuvable.");
  return category;
}

export const PATCH = route<P>(async (request, { id, categoryId }) => {
  await requireRestaurantAccess(id, "EDIT");
  await findCategory(id, categoryId);
  const input = categoryInputSchema.partial().parse(await readJson(request));
  if (input.parentId !== undefined) await assertCategoryParent(id, categoryId, input.parentId);
  if (input.imageAssetId) {
    const asset = await db.asset.findFirst({ where: { id: input.imageAssetId, restaurantId: id, kind: "IMAGE", status: "READY" } });
    if (!asset) throw badRequest("Image invalide.");
  }
  const category = await db.category.update({ where: { id: categoryId }, data: input });
  return { category };
});

/** Suppression : catégorie vide, ou plats déplacés (?moveTo=) ou supprimés (?withDishes=1). */
export const DELETE = route<P>(async (request, { id, categoryId }) => {
  await requireRestaurantAccess(id, "EDIT");
  await findCategory(id, categoryId);
  const url = new URL(request.url);
  const moveTo = url.searchParams.get("moveTo");
  const withDishes = url.searchParams.get("withDishes") === "1";
  const count = await db.dish.count({ where: { categoryId } });
  if (count && moveTo) {
    await findCategory(id, moveTo);
    if (moveTo === categoryId) throw badRequest("Choisissez une autre catégorie.");
    const last = await db.dish.findFirst({ where: { categoryId: moveTo }, orderBy: { position: "desc" }, select: { position: true } });
    const dishes = await db.dish.findMany({ where: { categoryId }, orderBy: { position: "asc" }, select: { id: true } });
    await db.$transaction(
      dishes.map((d, i) => db.dish.update({ where: { id: d.id }, data: { categoryId: moveTo, position: (last?.position ?? -1) + 1 + i } })),
    );
  } else if (count && !withDishes) {
    throw conflict(`Cette catégorie contient ${count} plat(s) : déplacez-les ou confirmez leur suppression.`);
  }
  await db.category.delete({ where: { id: categoryId } });
  return { ok: true };
});
