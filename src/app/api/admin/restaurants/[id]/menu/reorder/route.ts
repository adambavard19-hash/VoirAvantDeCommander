import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { reorderMenu, reorderSchema } from "@/lib/menu/editor";

export const POST = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  await reorderMenu(id, reorderSchema.parse(await readJson(request)));
  return { ok: true };
});
