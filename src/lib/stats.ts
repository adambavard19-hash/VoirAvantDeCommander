import "server-only";
import { db } from "@/lib/db";
import type { StatEvent } from "@/generated/prisma/client";

export const STAT_EVENTS: StatEvent[] = ["MENU_VIEW", "DISH_VIEW", "MODEL_VIEW", "AR_LAUNCH"];

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Incrémente un compteur journalier agrégé (aucune donnée personnelle). */
export async function recordEvent(restaurantId: string, event: StatEvent, dishId = "") {
  const day = today();
  await db.$executeRaw`
    INSERT INTO "DailyStat" ("id", "restaurantId", "day", "event", "dishId", "count")
    VALUES (${`s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}, ${restaurantId}, ${day}, ${event}::"StatEvent", ${dishId}, 1)
    ON CONFLICT ("restaurantId", "day", "event", "dishId") DO UPDATE SET "count" = "DailyStat"."count" + 1`;
}

export type StatTotals = Record<StatEvent, number>;

export async function statTotals(params: { restaurantId?: string; restaurantIds?: string[]; days: number }): Promise<StatTotals> {
  const since = new Date(Date.now() - params.days * 86400_000);
  const rows = await db.dailyStat.groupBy({
    by: ["event"],
    where: {
      day: { gte: since },
      ...(params.restaurantId ? { restaurantId: params.restaurantId } : {}),
      ...(params.restaurantIds ? { restaurantId: { in: params.restaurantIds } } : {}),
    },
    _sum: { count: true },
  });
  const totals = Object.fromEntries(STAT_EVENTS.map((e) => [e, 0])) as StatTotals;
  for (const r of rows) totals[r.event] = r._sum.count ?? 0;
  return totals;
}

/** Série quotidienne d'un événement (pour les graphiques). */
export async function statSeries(params: { restaurantId?: string; restaurantIds?: string[]; days: number; event: StatEvent }) {
  const since = new Date(Date.now() - (params.days - 1) * 86400_000);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await db.dailyStat.groupBy({
    by: ["day"],
    where: {
      event: params.event,
      day: { gte: since },
      ...(params.restaurantId ? { restaurantId: params.restaurantId } : {}),
      ...(params.restaurantIds ? { restaurantId: { in: params.restaurantIds } } : {}),
    },
    _sum: { count: true },
  });
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r._sum.count ?? 0]));
  return Array.from({ length: params.days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86400_000).toISOString().slice(0, 10);
    return { day: d, count: byDay.get(d) ?? 0 };
  });
}

/** Plats les plus consultés. */
export async function topDishes(restaurantId: string, days: number, limit = 5) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db.dailyStat.groupBy({
    by: ["dishId", "event"],
    where: { restaurantId, day: { gte: since }, dishId: { not: "" } },
    _sum: { count: true },
  });
  const byDish = new Map<string, { views: number; models: number; ar: number }>();
  for (const r of rows) {
    const entry = byDish.get(r.dishId) ?? { views: 0, models: 0, ar: 0 };
    if (r.event === "DISH_VIEW") entry.views += r._sum.count ?? 0;
    if (r.event === "MODEL_VIEW") entry.models += r._sum.count ?? 0;
    if (r.event === "AR_LAUNCH") entry.ar += r._sum.count ?? 0;
    byDish.set(r.dishId, entry);
  }
  const ranked = [...byDish.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, limit);
  const dishes = await db.dish.findMany({ where: { id: { in: ranked.map(([id]) => id) }, restaurantId }, select: { id: true, name: true } });
  const names = new Map(dishes.map((d) => [d.id, d.name]));
  return ranked.filter(([id]) => names.has(id)).map(([id, s]) => ({ id, name: names.get(id)!, ...s }));
}
