import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { categoryInputSchema } from "@/lib/menu/editor";
import { iconForCategoryName } from "@/lib/categories";

export const POST = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const input = categoryInputSchema.parse(await readJson(request));
  const last = await db.category.findFirst({ where: { restaurantId: id }, orderBy: { position: "desc" }, select: { position: true } });
  const category = await db.category.create({
    data: {
      restaurantId: id,
      name: input.name,
      description: input.description,
      icon: input.icon ?? iconForCategoryName(input.name),
      position: (last?.position ?? -1) + 1,
    },
  });
  return { category };
});
