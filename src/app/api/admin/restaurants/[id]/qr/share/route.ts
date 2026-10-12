import { z } from "zod";
import { readJson, route } from "@/lib/http";
import { requireRestaurantAccess } from "@/lib/auth/guards";
import { env, appUrl } from "@/lib/env";
import { signPayload } from "@/lib/crypto";
import { audit } from "@/lib/audit";

/**
 * Crée des liens de téléchargement signés (valables 30 jours) pour envoyer le
 * QR code au restaurateur sans qu'il ait besoin d'un compte.
 */
export const POST = route<{ id: string }>(async (request, { id }) => {
  const user = await requireRestaurantAccess(id, "EDIT");
  const { template } = z.object({ template: z.string().default("table-tent") }).parse(await readJson(request).catch(() => ({})));
  const ttl = 30 * 24 * 3600;
  const link = (format: string) =>
    `${appUrl()}/api/public/qr?token=${encodeURIComponent(signPayload(env().APP_SECRET, { r: id, f: format, t: template }, ttl))}`;
  await audit({ restaurantId: id, userId: user.id, action: "qr.share" });
  return { png: link("png"), svg: link("svg"), pdf: link("pdf"), expiresInDays: 30 };
});
