import { route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { duplicateDish } from "@/lib/menu/editor";

export const POST = route<{ id: string; dishId: string }>(async (_request, { id, dishId }) => {
  await requireRestaurantAccess(id, "EDIT");
  return { dish: await duplicateDish(id, dishId) };
});
