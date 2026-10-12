import { describe, expect, it } from "vitest";
import { parseMenuText } from "@/lib/import/parse-text";

const MENU = `
LA CARTE

ENTRÉES
Burrata crémeuse ........................ 14,50 €
Tomates anciennes, basilic, huile d'olive
Allergènes : lait

Œuf parfait – crème de champignons, noisettes torréfiées   12 €
(allergènes : œufs, fruits à coque, lait)

PLATS
Burger maison 19 €
Pain brioché, bœuf, cheddar affiné
Pizza 4 fromages ........ 16€50
Risotto aux cèpes
22,00 €

DESSERTS
Tiramisu 8,50 €
Fondant au chocolat noir 70 %   9 €

Boissons
Vin rouge — verre 6 € / bouteille 28 €
Eau minérale 50 cl 3,50 €
`;

describe("parseMenuText", () => {
  const result = parseMenuText(MENU, "menu.pdf");

  it("reconnaît les catégories", () => {
    expect(result.categories.map((c) => c.name)).toEqual(["Entrées", "Plats", "Desserts", "Boissons"]);
  });

  it("extrait noms, prix et descriptions", () => {
    const entrees = result.categories[0]!.dishes;
    expect(entrees[0]).toMatchObject({ name: "Burrata crémeuse", priceCents: 1450, description: "Tomates anciennes, basilic, huile d'olive" });
    expect(entrees[1]).toMatchObject({ name: "Œuf parfait", priceCents: 1200, description: "crème de champignons, noisettes torréfiées" });
    const plats = result.categories[1]!.dishes;
    expect(plats.map((d) => [d.name, d.priceCents])).toEqual([
      ["Burger maison", 1900],
      ["Pizza 4 fromages", 1650],
      ["Risotto aux cèpes", 2200],
    ]);
    expect(plats[0]!.description).toBe("Pain brioché, bœuf, cheddar affiné");
  });

  it("ne prend pas les quantités pour des prix", () => {
    const desserts = result.categories[2]!.dishes;
    expect(desserts[1]).toMatchObject({ name: "Fondant au chocolat noir 70 %", priceCents: 900 });
    const eau = result.categories[3]!.dishes[1]!;
    expect(eau).toMatchObject({ name: "Eau minérale 50 cl", priceCents: 350 });
  });

  it("détecte uniquement les allergènes explicitement mentionnés", () => {
    const entrees = result.categories[0]!.dishes;
    expect(entrees[0]!.allergens).toEqual(["milk"]);
    expect(entrees[1]!.allergens.sort()).toEqual(["eggs", "milk", "nuts"]);
    expect(result.categories[1]!.dishes[0]!.allergens).toEqual([]);
  });

  it("reconnaît les déclinaisons de prix", () => {
    const vin = result.categories[3]!.dishes[0]!;
    expect(vin.name).toBe("Vin rouge");
    expect(vin.variants).toEqual([
      { label: "verre", priceCents: 600 },
      { label: "bouteille", priceCents: 2800 },
    ]);
  });

  it("gère les menus sans symbole monétaire", () => {
    const r = parseMenuText("Desserts\nCrème brûlée 7\nTarte tatin 8\nCafé gourmand 9", "carte.txt");
    expect(r.categories[0]!.dishes.map((d) => d.priceCents)).toEqual([700, 800, 900]);
  });

  it("signale l'absence de plats", () => {
    expect(parseMenuText("Bienvenue !", "x.txt").warnings.length).toBeGreaterThan(0);
  });
});
