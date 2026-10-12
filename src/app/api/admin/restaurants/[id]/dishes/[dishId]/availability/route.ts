import { z } from "zod";
import { db } from "@/lib/db";
import { notFound, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { setDishAvailability } from "@/lib/menu/publish";
import { audit } from "@/lib/audit";

/** Disponibilité : appliquée immédiatement au menu en ligne, sans republier. */
export const POST = route<{ id: string; dishId: string }>(async (request, { id, dishId }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const { available } = z.object({ available: z.boolean() }).parse(await readJson(request));
  const dish = await db.dish.findFirst({ where: { id: dishId, restaurantId: id }, select: { id: true } });
  if (!dish) throw notFound("Plat introuvable.");
  await setDishAvailability(id, dishId, available);
  await audit({ restaurantId: id, userId: user.id, action: "dish.availability", details: { dishId, available } });
  return { ok: true, available };
});
