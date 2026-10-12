import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { publishMenu, publicationState, restoreVersion, setDishAvailability } from "@/lib/menu/publish";
import { loadPublicMenu } from "@/lib/menu/public";
import { changeSlug } from "@/lib/restaurants";
import { createTestRestaurant, createUser } from "./helpers";

describe("brouillon, publication et URL stable", () => {
  it("publie, isole le brouillon, met à jour la disponibilité en direct et garde l'URL du QR code", async () => {
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const cat = await db.category.findFirstOrThrow({ where: { restaurantId: r.id } });

    // Menu vide : publication bloquée.
    const blocked = await publishMenu(r.id, user.id);
    expect(blocked.ok).toBe(false);
    expect((await loadPublicMenu(r.slug)).kind).toBe("unavailable");

    const dish = await db.dish.create({ data: { restaurantId: r.id, categoryId: cat.id, name: "Burger", priceCents: 1800 } });
    const v1 = await publishMenu(r.id, user.id);
    expect(v1.ok).toBe(true);
    const qr = await db.qrCode.findUniqueOrThrow({ where: { restaurantId: r.id } });
    expect(qr.targetUrl).toBe(`https://test.voiravantdecommander.fr/menu/${r.slug}`);

    // Modification du brouillon : invisible tant qu'elle n'est pas publiée.
    await db.dish.update({ where: { id: dish.id }, data: { priceCents: 1950 } });
    let pub = await loadPublicMenu(r.slug);
    expect(pub.kind === "ok" && pub.snapshot.categories[0]!.dishes[0]!.priceCents).toBe(1800);
    expect((await publicationState(r.id)).hasUnpublishedChanges).toBe(true);

    // Rupture : appliquée immédiatement au menu en ligne, sans publier le nouveau prix.
    await setDishAvailability(r.id, dish.id, false);
    pub = await loadPublicMenu(r.slug);
    expect(pub.kind === "ok" && pub.snapshot.categories[0]!.dishes[0]).toMatchObject({ available: false, priceCents: 1800 });

    const v2 = await publishMenu(r.id, user.id);
    expect(v2.ok && v2.version.number).toBe(2);
    pub = await loadPublicMenu(r.slug);
    expect(pub.kind === "ok" && pub.snapshot.categories[0]!.dishes[0]!.priceCents).toBe(1950);

    // Retour à la version 1.
    if (v1.ok) await restoreVersion(r.id, v1.version.id, user.id);
    pub = await loadPublicMenu(r.slug);
    expect(pub.kind === "ok" && pub.snapshot.categories[0]!.dishes[0]!.priceCents).toBe(1800);

    // Changement d'adresse : l'ancienne (encodée dans le QR) redirige vers la nouvelle.
    const oldSlug = r.slug;
    await changeSlug(r.id, `${oldSlug}-nouveau`, user.id);
    const redirected = await loadPublicMenu(oldSlug);
    expect(redirected).toEqual({ kind: "redirect", slug: `${oldSlug}-nouveau` });
    expect((await db.qrCode.findUniqueOrThrow({ where: { restaurantId: r.id } })).targetUrl).toBe(qr.targetUrl);
  });

  it("ne publie que les plats et catégories visibles", async () => {
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const [c1, c2] = await db.category.findMany({ where: { restaurantId: r.id }, orderBy: { position: "asc" } });
    await db.dish.create({ data: { restaurantId: r.id, categoryId: c1!.id, name: "Visible", priceCents: 100 } });
    await db.dish.create({ data: { restaurantId: r.id, categoryId: c1!.id, name: "Masqué", isVisible: false } });
    await db.dish.create({ data: { restaurantId: r.id, categoryId: c2!.id, name: "Catégorie masquée" } });
    await db.category.update({ where: { id: c2!.id }, data: { isVisible: false } });
    const res = await publishMenu(r.id, user.id);
    expect(res.ok).toBe(true);
    const pub = await loadPublicMenu(r.slug);
    const names = pub.kind === "ok" ? pub.snapshot.categories.flatMap((c) => c.dishes.map((d) => d.name.fr)) : [];
    expect(names).toEqual(["Visible"]);
  });
});
