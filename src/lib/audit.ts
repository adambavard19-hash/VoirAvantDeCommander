import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Journalise une action sensible (publication, suppression, changement d'URL…). */
export async function audit(entry: {
  restaurantId?: string | null;
  userId?: string | null;
  action: string;
  details?: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        restaurantId: entry.restaurantId ?? null,
        userId: entry.userId ?? null,
        action: entry.action,
        details: (entry.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    // L'audit ne doit jamais faire échouer l'action principale.
    console.error("[audit] échec d'écriture", error);
  }
}
