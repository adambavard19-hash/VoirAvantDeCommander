import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { sourceHash } from "@/lib/i18n/translatable";
import { createTestRestaurant, createUser } from "./helpers";

// Fournisseur simulé : « traduit » en préfixant [en], sauf un texte dont il altère le nombre.
vi.mock("@/lib/ai", () => ({
  aiAvailable: () => true,
  aiErrorMessage: (e: unknown) => String(e),
  aiStructured: vi.fn(async ({ content }: { content: { text: string }[] }) => {
    const { items } = JSON.parse(content[0]!.text) as { items: { id: string; text: string }[] };
    return { translations: items.map((i) => ({ id: i.id, text: i.text.includes("70 %") ? "Chocolate 80%" : `[en] ${i.text}` })) };
  }),
}));
vi.mock("@/lib/env", async (orig) => {
  const mod = await orig<typeof import("@/lib/env")>();
  return { ...mod, env: () => ({ ...mod.env(), ANTHROPIC_API_KEY: "test" }) };
});

describe("traduction automatique", () => {
  it("traduit les textes manquants, respecte les corrections manuelles et rejette un nombre modifié", async () => {
    const { autoTranslate, translationOverview } = await import("@/lib/i18n/translate");
    const { buildSnapshot } = await import("@/lib/menu/snapshot");
    const user = await createUser();
    const r = await createTestRestaurant(user.id);
    const cat = await db.category.findFirstOrThrow({ where: { restaurantId: r.id } });
    const burger = await db.dish.create({ data: { restaurantId: r.id, categoryId: cat.id, name: "Burger maison", description: "Bœuf, cheddar", priceCents: 1900 } });
    const fondant = await db.dish.create({ data: { restaurantId: r.id, categoryId: cat.id, name: "Fondant", description: "Chocolat 70 %", priceCents: 900 } });
    // Traduction manuelle existante : elle ne doit pas être écrasée.
    await db.translation.create({
      data: { restaurantId: r.id, entityType: "DISH", entityId: burger.id, field: "name", locale: "en", value: "House burger", sourceHash: sourceHash("Burger maison"), source: "MANUAL" },
    });

    const report = await autoTranslate(r.id, ["en"]);
    expect(report[0]!.skipped).toBe(1); // « 70 % » devenu « 80% » : écarté
    const rows = await db.translation.findMany({ where: { restaurantId: r.id, locale: "en" } });
    const get = (id: string, field: string) => rows.find((t) => t.entityId === id && t.field === field);
    expect(get(burger.id, "name")!.value).toBe("House burger");
    expect(get(burger.id, "description")!.value).toBe("[en] Bœuf, cheddar");
    expect(get(fondant.id, "description")).toBeUndefined();

    // Le prix n'est jamais concerné et la traduction apparaît dans l'instantané.
    let snap = await buildSnapshot(r.id);
    const sBurger = snap.categories.flatMap((c) => c.dishes).find((d) => d.id === burger.id)!;
    expect(sBurger.name.en).toBe("House burger");
    expect(sBurger.priceCents).toBe(1900);
    expect(snap.autoTranslatedLocales).toEqual(["en"]);

    // Le texte d'origine change : l'ancienne traduction n'est plus affichée.
    await db.dish.update({ where: { id: burger.id }, data: { description: "Bœuf, cheddar, oignons confits" } });
    snap = await buildSnapshot(r.id);
    expect(snap.categories.flatMap((c) => c.dishes).find((d) => d.id === burger.id)!.description.en).toBeUndefined();
    const overview = await translationOverview(r.id);
    expect(overview.summary.find((s) => s.locale === "en")!.stale).toBe(1);
  });
});
