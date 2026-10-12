import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { requireRestaurantAccess, requireSuperAdmin } from "@/lib/auth/guards";
import { restaurantInputSchema, updateRestaurant } from "@/lib/restaurants";
import { storage, restaurantPrefix } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const GET = route<{ id: string }>(async (_request, { id }) => {
  await requireRestaurantAccess(id, "VIEW");
  const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id } });
  return { restaurant };
});

export const PATCH = route<{ id: string }>(async (request, { id }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const input = restaurantInputSchema.parse(await readJson(request));
  const restaurant = await updateRestaurant(id, input, user.id);
  return { restaurant: { id: restaurant.id, slug: restaurant.slug } };
});

/**
 * Par défaut : archivage (menu hors ligne, données conservées).
 * Suppression définitive (?permanent=1, administrateur principal uniquement) :
 * le nom du restaurant doit être confirmé.
 */
export const DELETE = route<{ id: string }>(async (request, { id }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("permanent") === "1") {
    const user = await requireSuperAdmin();
    const restaurant = await db.restaurant.findUniqueOrThrow({ where: { id }, select: { name: true } });
    if (url.searchParams.get("confirm") !== restaurant.name) throw badRequest("Confirmez en saisissant le nom exact du restaurant.");
    await storage().deletePrefix(restaurantPrefix(id));
    await db.restaurant.delete({ where: { id } });
    await audit({ userId: user.id, action: "restaurant.delete", details: { id, name: restaurant.name } });
    return { ok: true };
  }
  const user = await requireSuperAdmin();
  await db.restaurant.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
  await audit({ restaurantId: id, userId: user.id, action: "restaurant.archive" });
  return { ok: true };
});
