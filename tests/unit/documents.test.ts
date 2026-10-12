import { describe, expect, it } from "vitest";
import { extractMenuDocument } from "@/lib/import/documents";
import { makeMenuPdf, makeXlsx } from "../helpers/fixtures";

describe("extractMenuDocument — PDF", () => {
  it("lit un menu PDF avec prix alignés à droite", async () => {
    const pdf = await makeMenuPdf([
      [
        ["ENTREES"],
        ["Burrata cremeuse", "14,50 EUR"],
        ["Tomates anciennes, basilic"],
        [""],
        ["PLATS"],
        ["Burger maison", "19 EUR"],
        ["Pizza 4 fromages", "16,50 EUR"],
      ],
    ]);
    const r = await extractMenuDocument(pdf, "menu.pdf");
    expect(r.categories.map((c) => c.name)).toEqual(["Entrees", "Plats"]);
    expect(r.categories[0]!.dishes[0]).toMatchObject({ name: "Burrata cremeuse", priceCents: 1450, description: "Tomates anciennes, basilic" });
    expect(r.categories[1]!.dishes.map((d) => [d.name, d.priceCents])).toEqual([
      ["Burger maison", 1900],
      ["Pizza 4 fromages", 1650],
    ]);
  });

  it("lit un menu PDF en deux colonnes", async () => {
    const pdf = await makeMenuPdf([
      [["ENTREES"], ["Soupe du jour", "8 EUR"], ["Salade cesar", "12 EUR"], ["Carpaccio", "13 EUR"]],
      [["DESSERTS"], ["Tiramisu", "8,50 EUR"], ["Creme brulee", "7 EUR"], ["Mousse chocolat", "7,50 EUR"]],
    ]);
    const r = await extractMenuDocument(pdf, "menu.pdf");
    expect(r.categories.map((c) => c.name)).toEqual(["Entrees", "Desserts"]);
    expect(r.categories[0]!.dishes.map((d) => d.name)).toEqual(["Soupe du jour", "Salade cesar", "Carpaccio"]);
    expect(r.categories[1]!.dishes.map((d) => d.priceCents)).toEqual([850, 700, 750]);
  });

  it("signale un PDF sans texte", async () => {
    const r = await extractMenuDocument(await makeMenuPdf([[]]), "scan.pdf");
    expect(r.categories).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/scanné/);
  });
});

describe("extractMenuDocument — tableaux", () => {
  it("lit un CSV avec en-têtes français et séparateur ;", async () => {
    const csv = "Catégorie;Nom;Description;Prix;Allergènes;Photo;GLB;USDZ\nEntrées;Burrata;Tomates, basilic;14,50 €;lait;burrata.jpg;;\nPlats;Burger maison;Bœuf, cheddar;19;gluten, lait, moutarde;;burger-maison.glb;burger-maison.usdz\nBoissons;Vin rouge;;Verre 6 / Bouteille 28;sulfites;;;\n";
    const r = await extractMenuDocument(Buffer.from(csv, "utf8"), "carte.csv");
    expect(r.categories.map((c) => c.name)).toEqual(["Entrées", "Plats", "Boissons"]);
    const burger = r.categories[1]!.dishes[0]!;
    expect(burger).toMatchObject({ name: "Burger maison", priceCents: 1900, allergens: ["gluten", "milk", "mustard"] });
    expect(burger.files).toEqual({ glb: "burger-maison.glb", usdz: "burger-maison.usdz", photo: undefined });
    expect(r.categories[2]!.dishes[0]!.variants).toEqual([
      { label: "Verre", priceCents: 600 },
      { label: "Bouteille", priceCents: 2800 },
    ]);
  });

  it("lit un CSV encodé en Windows-1252", async () => {
    const csv = Buffer.from(new TextEncoder().encode("Nom,Prix\n")).toString("latin1") + "Crème brûlée,7\n";
    const r = await extractMenuDocument(Buffer.from(csv, "latin1"), "carte.csv");
    expect(r.categories[0]!.dishes[0]!.name).toBe("Crème brûlée");
  });

  it("lit un fichier Excel, une feuille par catégorie", async () => {
    const xlsx = makeXlsx([
      { name: "Entrées", rows: [["Nom", "Prix", "Description"], ["Velouté", 9, "Potimarron"], ["Œuf mimosa", 7.5, ""]] },
      { name: "Desserts", rows: [["Nom", "Prix"], ["Tarte tatin", 8]] },
    ]);
    const r = await extractMenuDocument(xlsx, "carte.xlsx");
    expect(r.categories.map((c) => c.name)).toEqual(["Entrées", "Desserts"]);
    expect(r.categories[0]!.dishes.map((d) => [d.name, d.priceCents, d.description])).toEqual([
      ["Velouté", 900, "Potimarron"],
      ["Œuf mimosa", 750, null],
    ]);
  });

  it("devine les colonnes sans en-têtes", async () => {
    const r = await extractMenuDocument(Buffer.from("Tiramisu,8.5\nPanna cotta,7\n"), "x.csv");
    expect(r.categories[0]!.dishes.map((d) => d.priceCents)).toEqual([850, 700]);
    expect(r.warnings.join(" ")).toMatch(/devinées/);
  });
});
