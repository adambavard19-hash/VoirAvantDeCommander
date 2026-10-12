import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { publishMenu } from "@/lib/menu/publish";

export const POST = route<{ id: string }>(async (request, { id }) => {
  const user = await requireRestaurantAccess(id, "PUBLISH");
  const { note } = z.object({ note: z.string().max(200).optional() }).parse(await readJson(request).catch(() => ({})));
  const result = await publishMenu(id, user.id, note);
  if (!result.ok) return Response.json({ error: "Le menu ne peut pas encore être publié.", issues: result.issues }, { status: 422 });
  return { version: { number: result.version.number, publishedAt: result.version.publishedAt }, issues: result.issues };
});
