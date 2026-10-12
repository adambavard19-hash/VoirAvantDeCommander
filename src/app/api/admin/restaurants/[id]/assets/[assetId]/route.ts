import { db } from "@/lib/db";
import { conflict, notFound, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { deleteAsset } from "@/lib/assets/service";

/** Supprime un fichier, uniquement s'il n'est plus utilisé par le brouillon. */
export const DELETE = route<{ id: string; assetId: string }>(async (_request, { id, assetId }) => {
  await requireRestaurantAccess(id, "EDIT");
  const asset = await db.asset.findFirst({
    where: { id: assetId, restaurantId: id },
    include: { _count: { select: { photoOf: true, glbOf: true, usdzOf: true, logoOf: true, coverOf: true, categoryOf: true } } },
  });
  if (!asset) throw notFound("Fichier introuvable.");
  const uses = Object.values(asset._count).reduce((a, b) => a + b, 0);
  if (uses > 0) throw conflict("Ce fichier est encore utilisé dans le menu.");
  await deleteAsset(asset);
  return { ok: true };
});
