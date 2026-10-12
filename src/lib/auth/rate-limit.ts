import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmac } from "@/lib/crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 30;

export function hashIp(ip: string | null): string | null {
  return ip ? hmac(env().APP_SECRET, `ip:${ip}`) : null;
}

/** Limitation des tentatives de connexion, partagée entre instances (stockée en base). */
export async function isLoginBlocked(email: string, ipHash: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    ipHash ? db.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  return byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginAttempt(email: string, ipHash: string | null, success: boolean) {
  await db.loginAttempt.create({ data: { email, ipHash, success } });
  // Nettoyage opportuniste des anciennes tentatives (> 30 jours).
  if (Math.random() < 0.02) {
    await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } } });
  }
}
