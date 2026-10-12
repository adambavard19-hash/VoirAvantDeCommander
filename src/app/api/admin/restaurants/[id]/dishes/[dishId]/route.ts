import { db } from "@/lib/db";
import { notFound, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { dishInputSchema, updateDish } from "@/lib/menu/editor";

type P = { id: string; dishId: string };

export const PATCH = route<P>(async (request, { id, dishId }) => {
  await requireRestaurantAccess(id, "EDIT");
  const dish = await updateDish(id, dishId, dishInputSchema.partial().parse(await readJson(request)));
  return { dish };
});

export const DELETE = route<P>(async (_request, { id, dishId }) => {
  await requireRestaurantAccess(id, "EDIT");
  const { count } = await db.dish.deleteMany({ where: { id: dishId, restaurantId: id } });
  if (!count) throw notFound("Plat introuvable.");
  await db.translation.deleteMany({ where: { restaurantId: id, entityType: "DISH", entityId: dishId } });
  return { ok: true };
});
