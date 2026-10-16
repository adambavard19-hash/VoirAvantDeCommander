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

type Scope = { restaurantId?: string; restaurantIds?: string[] };

function scopeWhere(p: Scope) {
  return {
    ...(p.restaurantId ? { restaurantId: p.restaurantId } : {}),
    ...(p.restaurantIds ? { restaurantId: { in: p.restaurantIds } } : {}),
  };
}

/** Premier jour (UTC, inclus) d'une période de `days` jours se terminant aujourd'hui. */
function periodStart(days: number): Date {
  return new Date(today().getTime() - (days - 1) * 86400_000);
}

/**
 * Totaux de la période en cours et de la période précédente de même durée
 * (ex. 30 derniers jours et les 30 jours d'avant), pour calculer une évolution réelle.
 */
export async function statComparison(params: Scope & { days: number }): Promise<{ current: StatTotals; previous: StatTotals }> {
  const start = periodStart(params.days);
  const prevStart = new Date(start.getTime() - params.days * 86400_000);
  const rows = await db.dailyStat.groupBy({
    by: ["event", "day"],
    where: { day: { gte: prevStart }, ...scopeWhere(params) },
    _sum: { count: true },
  });
  const empty = () => Object.fromEntries(STAT_EVENTS.map((e) => [e, 0])) as StatTotals;
  const current = empty();
  const previous = empty();
  for (const r of rows) (r.day >= start ? current : previous)[r.event] += r._sum.count ?? 0;
  return { current, previous };
}

export type DailyPoint = { day: string } & StatTotals;

/** Série quotidienne de tous les événements (graphique d'évolution multi-courbes). */
export async function statDaily(params: Scope & { days: number }): Promise<DailyPoint[]> {
  const start = periodStart(params.days);
  const rows = await db.dailyStat.groupBy({
    by: ["day", "event"],
    where: { day: { gte: start }, ...scopeWhere(params) },
    _sum: { count: true },
  });
  const byDay = new Map<string, DailyPoint>();
  for (let i = 0; i < params.days; i++) {
    const day = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
    byDay.set(day, { day, MENU_VIEW: 0, DISH_VIEW: 0, MODEL_VIEW: 0, AR_LAUNCH: 0 });
  }
  for (const r of rows) {
    const point = byDay.get(r.day.toISOString().slice(0, 10));
    if (point) point[r.event] += r._sum.count ?? 0;
  }
  return [...byDay.values()];
}

/** Plats les plus consultés sur plusieurs restaurants (tableau de bord général). */
export async function topDishesAcross(restaurantIds: string[], days: number, limit = 5) {
  if (!restaurantIds.length) return [];
  const rows = await db.dailyStat.groupBy({
    by: ["dishId", "event"],
    where: { restaurantId: { in: restaurantIds }, day: { gte: periodStart(days) }, dishId: { not: "" } },
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
  const ranked = [...byDish.entries()].sort((a, b) => b[1].views - a[1].views || b[1].models - a[1].models).slice(0, limit);
  const dishes = await db.dish.findMany({
    where: { id: { in: ranked.map(([id]) => id) }, restaurantId: { in: restaurantIds } },
    select: { id: true, name: true, restaurant: { select: { id: true, name: true } } },
  });
  const info = new Map(dishes.map((d) => [d.id, d]));
  return ranked
    .filter(([id]) => info.has(id))
    .map(([id, s]) => ({ id, name: info.get(id)!.name, restaurantId: info.get(id)!.restaurant.id, restaurantName: info.get(id)!.restaurant.name, ...s }));
}

/** Date de début d'une fenêtre glissante de `days` jours (filtres sur createdAt). */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400_000);
}
