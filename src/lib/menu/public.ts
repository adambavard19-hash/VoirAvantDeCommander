import "server-only";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { checkRestaurantAccess } from "@/lib/auth/guards";
import { buildSnapshot } from "./snapshot";
import type { MenuSnapshot } from "./types";

export type PublicMenuResult =
  | { kind: "ok"; snapshot: MenuSnapshot; preview: boolean }
  | { kind: "redirect"; slug: string }
  | { kind: "unavailable"; name: string }
  | { kind: "not-found" };

/**
 * Menu public par slug. Lit l'instantané publié (une seule requête indexée).
 * Avec `preview`, un utilisateur ayant accès au restaurant voit le brouillon.
 */
export async function loadPublicMenu(slug: string, opts: { preview?: boolean } = {}): Promise<PublicMenuResult> {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, publishedVersion: { select: { snapshot: true } } },
  });

  if (!restaurant) {
    // Ancien slug : un QR code déjà imprimé continue de fonctionner.
    const redirect = await db.slugRedirect.findUnique({ where: { slug }, select: { restaurant: { select: { slug: true } } } });
    return redirect ? { kind: "redirect", slug: redirect.restaurant.slug } : { kind: "not-found" };
  }

  if (opts.preview) {
    const user = await getCurrentUser();
    if (user && (await checkRestaurantAccess(user, restaurant.id, "VIEW"))) {
      return { kind: "ok", snapshot: await buildSnapshot(restaurant.id), preview: true };
    }
  }

  if (restaurant.status === "ARCHIVED") return { kind: "not-found" };
  if (restaurant.status !== "PUBLISHED" || !restaurant.publishedVersion) return { kind: "unavailable", name: restaurant.name };
  const snapshot = restaurant.publishedVersion.snapshot as unknown as MenuSnapshot;
  // Le slug courant prime sur celui figé dans l'instantané (changement d'adresse sans republication).
  return { kind: "ok", snapshot: { ...snapshot, restaurant: { ...snapshot.restaurant, slug } }, preview: false };
}
