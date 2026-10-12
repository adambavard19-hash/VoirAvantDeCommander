import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import type { User } from "@/generated/prisma/client";

const SESSION_TTL_MS = 14 * 24 * 3600 * 1000; // 14 jours, prolongée à l'usage
const TOUCH_INTERVAL_MS = 3600 * 1000;

const isProd = process.env.NODE_ENV === "production";
/** En production, le préfixe __Host- impose Secure + Path=/ sans domaine. */
export const SESSION_COOKIE = isProd ? "__Host-vadc_session" : "vadc_session";

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

export async function createSession(userId: string, userAgent: string | null) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Utilisateur connecté (mis en cache pour la durée de la requête), ou null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
  }
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
});
