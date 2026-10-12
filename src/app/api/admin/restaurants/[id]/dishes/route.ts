import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { createDish, dishInputSchema } from "@/lib/menu/editor";

export const POST = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const dish = await createDish(id, dishInputSchema.parse(await readJson(request)));
  return { dish };
});
