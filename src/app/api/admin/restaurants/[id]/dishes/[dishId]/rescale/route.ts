import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { rescaleDishModel } from "@/lib/menu/editor";
import { toAssetDto } from "@/lib/assets/service";

const schema = z.object({ targetCm: z.number().positive().max(300), axis: z.enum(["width", "depth", "height"]) });

export const POST = route<{ id: string; dishId: string }>(async (request, { id, dishId }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const { targetCm, axis } = schema.parse(await readJson(request));
  const { asset, factor } = await rescaleDishModel({ restaurantId: id, dishId, userId: user.id, targetCm, axis });
  return { asset: toAssetDto(asset), factor };
});
