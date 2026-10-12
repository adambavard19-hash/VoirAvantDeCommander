import { db } from "@/lib/db";
import { route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";

/** Met le menu hors ligne (le QR code affiche « menu bientôt disponible »). */
export const POST = route<{ id: string }>(async (_request, { id }) => {
  const user = await requireRestaurantAccess(id, "PUBLISH");
  await db.restaurant.update({ where: { id }, data: { status: "SUSPENDED" } });
  await audit({ restaurantId: id, userId: user.id, action: "menu.unpublish" });
  return { ok: true };
});
