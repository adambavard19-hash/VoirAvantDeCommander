import { route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { plateRimDishModel } from "@/lib/menu/editor";
import { toAssetDto } from "@/lib/assets/service";

/** Propose une version du modèle au bord d'assiette régularisé (rien n'est remplacé). */
export const POST = route<{ id: string; dishId: string }>(async (_request, { id, dishId }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const { original, corrected, info } = await plateRimDishModel({ restaurantId: id, dishId, userId: user.id });
  return { original: toAssetDto(original), corrected: toAssetDto(corrected), info };
});
