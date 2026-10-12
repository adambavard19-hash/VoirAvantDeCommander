import { notFound, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { restoreVersion } from "@/lib/menu/publish";

export const POST = route<{ id: string; versionId: string }>(async (_request, { id, versionId }) => {
  const user = await requireRestaurantAccess(id, "PUBLISH");
  const version = await restoreVersion(id, versionId, user.id);
  if (!version) throw notFound("Version introuvable.");
  return { version: { number: version.number } };
});
