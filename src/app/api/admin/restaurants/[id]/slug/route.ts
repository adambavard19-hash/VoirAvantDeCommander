import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { changeSlug } from "@/lib/restaurants";

export const POST = route<{ id: string }>(async (request, { id }) => {
  const user = await requireSuperAdmin();
  const { slug } = z.object({ slug: z.string().trim().toLowerCase() }).parse(await readJson(request));
  return changeSlug(id, slug, user.id);
});
