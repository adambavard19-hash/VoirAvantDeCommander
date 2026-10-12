import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { getCurrentUser, type SessionUser } from "./session";
import type { MemberRole, Prisma } from "@/generated/prisma/client";

export type AccessLevel = "VIEW" | "EDIT" | "PUBLISH";

/** Correspondance rôle de membre → niveau d'accès maximal. */
const MEMBER_LEVELS: Record<MemberRole, AccessLevel[]> = {
  OWNER: ["VIEW", "EDIT", "PUBLISH"],
  EDITOR: ["VIEW", "EDIT"],
};

export function isSuperAdmin(user: SessionUser | null): boolean {
  return user?.role === "SUPER_ADMIN";
}

/** Pour les API : lève 401 si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) throw forbidden("Réservé à l'administrateur principal.");
  return user;
}

/** Pour les pages : redirige vers la connexion si nécessaire. */
export async function requireUserPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireSuperAdminPage(): Promise<SessionUser> {
  const user = await requireUserPage();
  if (!isSuperAdmin(user)) redirect("/admin");
  return user;
}

/**
 * Vérifie l'accès d'un utilisateur à un restaurant. C'est le point de contrôle
 * unique de l'isolation entre restaurants : toute route d'administration portant
 * un identifiant de restaurant doit passer par ici.
 */
export async function checkRestaurantAccess(
  user: SessionUser,
  restaurantId: string,
  level: AccessLevel,
): Promise<boolean> {
  if (isSuperAdmin(user)) return true;
  const membership = await db.restaurantMember.findUnique({
    where: { userId_restaurantId: { userId: user.id, restaurantId } },
    select: { role: true },
  });
  return !!membership && MEMBER_LEVELS[membership.role].includes(level);
}

export async function requireRestaurantAccess(restaurantId: string, level: AccessLevel = "EDIT") {
  const user = await requireUser();
  const exists = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
  // Même réponse « introuvable » que l'accès soit refusé ou le restaurant inexistant,
  // pour ne pas révéler l'existence de restaurants d'autres clients.
  if (!exists || !(await checkRestaurantAccess(user, restaurantId, level))) throw notFound("Restaurant introuvable.");
  return user;
}

export async function requireRestaurantAccessPage(restaurantId: string, level: AccessLevel = "VIEW") {
  const user = await requireUserPage();
  if (!(await checkRestaurantAccess(user, restaurantId, level))) redirect("/admin");
  return user;
}

/** Filtre Prisma limitant une liste de restaurants à ceux accessibles par l'utilisateur. */
export function restaurantScope(user: SessionUser): Prisma.RestaurantWhereInput {
  return isSuperAdmin(user) ? {} : { members: { some: { userId: user.id } } };
}
