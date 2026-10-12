import "server-only";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { audit } from "@/lib/audit";
import { buildSnapshot, snapshotHash } from "./snapshot";
import type { MenuSnapshot } from "./types";
import type { Prisma } from "@/generated/prisma/client";

export type ReadinessIssue = {
  level: "blocking" | "warning";
  code: string;
  message: string;
  dishId?: string;
};

/** Contrôles avant publication. Les points bloquants empêchent de publier un menu incomplet. */
export async function checkReadiness(restaurantId: string, snapshot?: MenuSnapshot): Promise<ReadinessIssue[]> {
  const snap = snapshot ?? (await buildSnapshot(restaurantId));
  const issues: ReadinessIssue[] = [];
  const dishes = snap.categories.flatMap((c) => c.dishes);

  if (dishes.length === 0)
    issues.push({ level: "blocking", code: "empty", message: "Le menu ne contient aucun plat visible." });

  const pending = await db.asset.count({ where: { restaurantId, status: "PENDING", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (pending) issues.push({ level: "warning", code: "uploads", message: `${pending} fichier(s) en cours de téléversement.` });

  for (const d of dishes) {
    const name = d.name[snap.restaurant.defaultLocale] ?? "Plat";
    if (d.priceCents === null && d.variants.length === 0)
      issues.push({ level: "warning", code: "price", message: `« ${name} » n'a pas de prix.`, dishId: d.id });
    if (!d.photo) issues.push({ level: "warning", code: "photo", message: `« ${name} » n'a pas de photo.`, dishId: d.id });
    if (d.model && !d.model.glbKey)
      issues.push({ level: "warning", code: "glb", message: `« ${name} » : fichier GLB manquant (3D indisponible sur Android et ordinateur).`, dishId: d.id });
    if (d.model?.glbKey && !d.model.usdzKey)
      issues.push({ level: "warning", code: "usdz", message: `« ${name} » : pas de USDZ, l'AR iPhone utilisera une conversion automatique du GLB.`, dishId: d.id });
    if (d.model && !d.model.scaleValidated)
      issues.push({ level: "warning", code: "scale", message: `« ${name} » : taille réelle non validée (AR redimensionnable).`, dishId: d.id });
  }

  // Traductions manquantes ou obsolètes
  const otherLocales = snap.restaurant.locales.filter((l) => l !== snap.restaurant.defaultLocale);
  if (otherLocales.length) {
    const missing = new Map<string, number>();
    const check = (text: Record<string, string>) => {
      if (!text[snap.restaurant.defaultLocale]) return;
      for (const l of otherLocales) if (!text[l]) missing.set(l, (missing.get(l) ?? 0) + 1);
    };
    for (const c of snap.categories) {
      check(c.name);
      check(c.description);
      for (const d of c.dishes) {
        check(d.name);
        check(d.description);
      }
    }
    for (const [locale, count] of missing)
      issues.push({
        level: "warning",
        code: "translation",
        message: `${count} texte(s) sans traduction à jour en « ${locale} » (affichés dans la langue principale).`,
      });
  }
  return issues;
}

export function menuUrl(slug: string): string {
  return `${appUrl()}/menu/${slug}`;
}

/** Garantit l'existence du QR code du restaurant. Son URL est figée à la création. */
export async function ensureQrCode(restaurantId: string, slug: string) {
  return db.qrCode.upsert({
    where: { restaurantId },
    update: {},
    create: { restaurantId, targetUrl: menuUrl(slug), style: {} },
  });
}

export async function publishMenu(restaurantId: string, userId: string, note?: string) {
  const snapshot = await buildSnapshot(restaurantId);
  const issues = await checkReadiness(restaurantId, snapshot);
  const blocking = issues.filter((i) => i.level === "blocking");
  if (blocking.length) return { ok: false as const, issues };

  const contentHash = snapshotHash(snapshot);
  const version = await db.$transaction(async (tx) => {
    const last = await tx.menuVersion.findFirst({ where: { restaurantId }, orderBy: { number: "desc" }, select: { number: true } });
    const created = await tx.menuVersion.create({
      data: {
        restaurantId,
        number: (last?.number ?? 0) + 1,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        contentHash,
        note: note?.slice(0, 200),
        publishedById: userId,
      },
    });
    const restaurant = await tx.restaurant.update({
      where: { id: restaurantId },
      data: { publishedVersionId: created.id, status: "PUBLISHED" },
      select: { firstPublishedAt: true },
    });
    if (!restaurant.firstPublishedAt)
      await tx.restaurant.update({ where: { id: restaurantId }, data: { firstPublishedAt: new Date() } });
    return created;
  });
  await ensureQrCode(restaurantId, snapshot.restaurant.slug);
  await audit({ restaurantId, userId, action: "menu.publish", details: { version: version.number } });
  return { ok: true as const, version, issues };
}

/** Remet en ligne une version publiée antérieure (sans toucher au brouillon). */
export async function restoreVersion(restaurantId: string, versionId: string, userId: string) {
  const version = await db.menuVersion.findFirst({ where: { id: versionId, restaurantId } });
  if (!version) return null;
  await db.restaurant.update({ where: { id: restaurantId }, data: { publishedVersionId: version.id, status: "PUBLISHED" } });
  await audit({ restaurantId, userId, action: "menu.restore", details: { version: version.number } });
  return version;
}

/**
 * Disponibilité d'un plat : changement immédiat, sans republier tout le menu
 * (un plat en rupture doit disparaître de la carte tout de suite). Le brouillon
 * et la version en ligne sont mis à jour ensemble.
 */
export async function setDishAvailability(restaurantId: string, dishId: string, available: boolean) {
  await db.dish.update({ where: { id: dishId, restaurantId }, data: { isAvailable: available } });
  const restaurant = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { publishedVersion: { select: { id: true, snapshot: true } } },
  });
  const published = restaurant?.publishedVersion;
  if (!published) return;
  const snapshot = published.snapshot as unknown as MenuSnapshot;
  let changed = false;
  for (const c of snapshot.categories)
    for (const d of c.dishes)
      if (d.id === dishId && d.available !== available) {
        d.available = available;
        changed = true;
      }
  if (changed)
    await db.menuVersion.update({
      where: { id: published.id },
      data: { snapshot: snapshot as unknown as Prisma.InputJsonValue, contentHash: snapshotHash(snapshot) },
    });
}

/** État de publication : y a-t-il des modifications non publiées ? */
export async function publicationState(restaurantId: string) {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { status: true, publishedVersion: { select: { number: true, contentHash: true, publishedAt: true } } },
  });
  const draft = await buildSnapshot(restaurantId);
  const draftHash = snapshotHash(draft);
  return {
    status: restaurant.status,
    published: restaurant.publishedVersion,
    hasUnpublishedChanges: !restaurant.publishedVersion || restaurant.publishedVersion.contentHash !== draftHash,
    draft,
  };
}
