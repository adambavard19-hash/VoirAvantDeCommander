import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { finalizeAsset, toAssetDto } from "@/lib/assets/service";

const schema = z.object({ assetIds: z.array(z.string()).min(1).max(50) });

/** Finalise des téléversements : vérification, optimisation des images, analyse des modèles 3D. */
export const POST = route<{ id: string }>(async (request, { id }) => {
  await requireRestaurantAccess(id, "EDIT");
  const { assetIds } = schema.parse(await readJson(request));
  const assets = [];
  for (const assetId of assetIds) assets.push(toAssetDto(await finalizeAsset(id, assetId)));
  return { assets };
});
