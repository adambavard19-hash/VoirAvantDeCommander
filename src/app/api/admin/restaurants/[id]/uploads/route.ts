import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { reserveUploads } from "@/lib/assets/service";

const schema = z.object({
  files: z
    .array(z.object({ name: z.string().min(1).max(255), size: z.number().int().min(0), path: z.string().max(500).optional() }))
    .min(1)
    .max(300),
  importJobId: z.string().optional(),
  accept: z.array(z.enum(["image", "glb", "usdz", "video", "menu-document", "archive"])).optional(),
});

/** Réserve des emplacements et renvoie les URL de téléversement direct. */
export const POST = route<{ id: string }>(async (request, { id }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const body = schema.parse(await readJson(request));
  if (body.importJobId) {
    const job = await db.importJob.findFirst({ where: { id: body.importJobId, restaurantId: id } });
    if (!job) throw badRequest("Import introuvable.");
  }
  return reserveUploads({ restaurantId: id, userId: user.id, files: body.files, importJobId: body.importJobId, accept: body.accept });
});
